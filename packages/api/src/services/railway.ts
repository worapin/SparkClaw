import { db, instances, users, subscriptions } from "@sparkclaw/shared/db";
import {
  INSTANCE_POLL_INTERVAL_MS,
  INSTANCE_POLL_MAX_ATTEMPTS,
  INSTANCE_PROVISION_MAX_RETRIES,
} from "@sparkclaw/shared/constants";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { getEnv } from "@sparkclaw/shared";
import { configureOpenClaw } from "./openclaw.js";
import { sendInstanceReadyEmail } from "./email.js";

const RAILWAY_API_URL = "https://backboard.railway.app/graphql/v2";

async function railwayRequest(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(RAILWAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RAILWAY_API_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Railway API error: ${res.status} ${await res.text()}`);
  }

  const json = await res.json() as { data?: Record<string, any>; errors?: { message: string }[] };

  if (json.errors?.length) {
    throw new Error(`Railway GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`);
  }

  return json;
}

// Generate a unique custom domain for the instance
export function generateCustomDomain(instanceId: string): string {
  const env = getEnv();
  const rootDomain = env.CUSTOM_DOMAIN_ROOT;
  // Create subdomain like "claw-a1b2c3d4.sparkclaw.io"
  const subdomain = `claw-${instanceId.slice(0, 8)}`.toLowerCase();
  return `${subdomain}.${rootDomain}`;
}

// Create Railway service and deploy OpenClaw from template
async function createRailwayServiceWithTemplate(
  instanceId: string,
  environmentId: string,
  userId: string,
) {
  const projectId = process.env.RAILWAY_PROJECT_ID!;
  const env = getEnv();

  // Create service
  const serviceResult = await railwayRequest(
    `mutation($input: ServiceCreateInput!) {
      serviceCreate(input: $input) {
        id
      }
    }`,
    {
      input: {
        projectId,
        name: `openclaw-${instanceId.slice(0, 8)}`,
      },
    },
  );

  const serviceId = serviceResult.data!.serviceCreate.id as string;
  logger.info("Railway service created", { instanceId, serviceId });

  // Connect GitHub repo (OpenClaw template fork)
  const repo = process.env.OPENCLAW_GITHUB_REPO!;
  
  await railwayRequest(
    `mutation($input: ServiceConnectInput!) {
      serviceConnect(input: $input) {
        id
      }
    }`,
    {
      input: {
        serviceId,
        repo,
        branch: "main",
      },
    },
  );

  logger.info("GitHub repo connected to service", { instanceId, serviceId, repo });

  // Set environment variables for OpenClaw
  const envVars = {
    INSTANCE_ID: instanceId,
    USER_ID: userId,
    PRISM_BASE_URL: process.env.PRISM_BASE_URL || "",
    PRISM_API_KEY: process.env.PRISM_API_KEY || "",
    OPENCLAW_GATEWAY_TOKEN: generateGatewayToken(instanceId),
    NODE_ENV: "production",
  };

  for (const [key, value] of Object.entries(envVars)) {
    await railwayRequest(
      `mutation($input: VariableUpsertInput!) {
        variableUpsert(input: $input) {
          id
        }
      }`,
      {
        input: {
          serviceId,
          environmentId,
          name: key,
          value,
        },
      },
    );
  }

  logger.info("Environment variables set", { instanceId, serviceId, vars: Object.keys(envVars) });

  return serviceId;
}

// Generate a gateway token for OpenClaw instance
function generateGatewayToken(instanceId: string): string {
  // Simple token generation - in production use proper JWT or similar
  const secret = process.env.SESSION_SECRET!;
  const data = `${instanceId}:${Date.now()}`;
  return Buffer.from(`${data}:${secret}`).toString("base64");
}

// Check deployment status
async function getDeploymentStatus(serviceId: string, environmentId: string): Promise<{ status: string; url?: string }> {
  const result = await railwayRequest(
    `query($serviceId: String!, $environmentId: String!) {
      service(id: $serviceId) {
        deployments(environmentId: $environmentId) {
          edges {
            node {
              status
              url
            }
          }
        }
      }
    }`,
    { serviceId, environmentId },
  );

  const deployments = result.data?.service?.deployments?.edges;
  if (!deployments || deployments.length === 0) {
    return { status: "pending" };
  }

  const latest = deployments[0].node;
  return {
    status: latest.status.toLowerCase(),
    url: latest.url,
  };
}

async function createServiceDomain(serviceId: string, environmentId: string): Promise<string> {
  const result = await railwayRequest(
    `mutation($input: ServiceDomainCreateInput!) {
      serviceDomainCreate(input: $input) {
        domain
      }
    }`,
    {
      input: {
        serviceId,
        environmentId,
      },
    },
  );

  return result.data!.serviceDomainCreate.domain as string;
}

// Add custom domain to Railway service
async function addCustomDomain(serviceId: string, domain: string): Promise<void> {
  await railwayRequest(
    `mutation($input: CustomDomainCreateInput!) {
      customDomainCreate(input: $input) {
        id
        domain
        status {
          dnsStatus
        }
      }
    }`,
    {
      input: {
        serviceId,
        domain,
      },
    },
  );

  logger.info("Custom domain added to Railway service", { serviceId, domain });
}

// Get custom domain status from Railway
async function getCustomDomainStatus(serviceId: string, domain: string): Promise<{ dnsStatus: string } | null> {
  const result = await railwayRequest(
    `query($serviceId: String!) {
      service(id: $serviceId) {
        customDomains {
          domain
          status {
            dnsStatus
          }
        }
      }
    }`,
    { serviceId },
  );

  const domains = result.data?.service?.customDomains;
  if (!domains || domains.length === 0) return null;
  
  const customDomain = domains.find((d: any) => d.domain === domain);
  if (!customDomain) return null;
  
  return { dnsStatus: customDomain.status?.dnsStatus };
}

async function getServiceDomain(serviceId: string): Promise<string | null> {
  const result = await railwayRequest(
    `query($serviceId: String!) {
      service(id: $serviceId) {
        serviceDomains {
          domain
        }
      }
    }`,
    { serviceId },
  );

  const domains = result.data?.service?.serviceDomains;
  if (!domains || domains.length === 0) return null;
  return domains[0].domain as string;
}

async function getProjectEnvironmentId(): Promise<string> {
  const projectId = process.env.RAILWAY_PROJECT_ID!;
  const result = await railwayRequest(
    `query($projectId: String!) {
      project(id: $projectId) {
        environments {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    }`,
    { projectId },
  );

  const edges = result.data?.project?.environments?.edges;
  if (!edges?.length) throw new Error("No environments found in Railway project");

  const prodEnv = edges.find((e: any) => e.node.name === "production");
  return (prodEnv || edges[0]).node.id as string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function provisionInstance(
  userId: string,
  subscriptionId: string,
): Promise<void> {
  // Generate custom domain upfront
  const instanceId = crypto.randomUUID();
  const customDomain = generateCustomDomain(instanceId);
  const gatewayToken = generateGatewayToken(instanceId);
  
  const [instance] = await db
    .insert(instances)
    .values({
      id: instanceId,
      userId,
      subscriptionId,
      railwayProjectId: process.env.RAILWAY_PROJECT_ID!,
      customDomain,
      status: "pending",
      domainStatus: "pending",
    })
    .returning();

  // Get user info for email
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  // Get subscription for plan info
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.id, subscriptionId),
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < INSTANCE_PROVISION_MAX_RETRIES; attempt++) {
    try {
      // Step 1: Get environment ID
      const environmentId = await getProjectEnvironmentId();
      
      // Step 2: Create Railway service with OpenClaw template
      logger.info("Creating Railway service with OpenClaw template", { instanceId: instance.id });
      const serviceId = await createRailwayServiceWithTemplate(
        instance.id, 
        environmentId,
        userId
      );

      await db
        .update(instances)
        .set({ railwayServiceId: serviceId, updatedAt: new Date() })
        .where(eq(instances.id, instance.id));

      // Step 3: Wait for deployment to complete
      logger.info("Waiting for OpenClaw deployment", { instanceId: instance.id });
      
      let deploymentReady = false;
      for (let poll = 0; poll < INSTANCE_POLL_MAX_ATTEMPTS; poll++) {
        await sleep(INSTANCE_POLL_INTERVAL_MS);
        
        const deployment = await getDeploymentStatus(serviceId, environmentId);
        
        if (deployment.status === "success") {
          deploymentReady = true;
          logger.info("OpenClaw deployment successful", { 
            instanceId: instance.id, 
            url: deployment.url 
          });
          break;
        } else if (deployment.status === "failed") {
          throw new Error("OpenClaw deployment failed on Railway");
        }
      }
      
      if (!deploymentReady) {
        throw new Error("OpenClaw deployment timeout");
      }

      // Step 4: Create Railway domain (internal)
      const railwayDomain = await createServiceDomain(serviceId, environmentId);
      
      if (railwayDomain) {
        await db
          .update(instances)
          .set({
            railwayUrl: `https://${railwayDomain}`,
            updatedAt: new Date(),
          })
          .where(eq(instances.id, instance.id));

        logger.info("Railway domain created", { instanceId: instance.id, railwayUrl: railwayDomain });
      }

      // Step 5: Add custom domain
      await db
        .update(instances)
        .set({ domainStatus: "provisioning", updatedAt: new Date() })
        .where(eq(instances.id, instance.id));

      await addCustomDomain(serviceId, customDomain);
      
      logger.info("Custom domain added to service", { instanceId: instance.id, customDomain });

      // Step 6: Wait for custom domain DNS
      let domainReady = false;
      for (let poll = 0; poll < INSTANCE_POLL_MAX_ATTEMPTS; poll++) {
        await sleep(INSTANCE_POLL_INTERVAL_MS);

        const status = await getCustomDomainStatus(serviceId, customDomain);
        
        if (status) {
          domainReady = true;
          break;
        }
      }

      if (!domainReady) {
        throw new Error("Custom domain DNS provisioning timeout");
      }

      // Step 7: Configure OpenClaw
      const instanceUrl = `https://${customDomain}`;
      logger.info("Configuring OpenClaw instance", { instanceId: instance.id, instanceUrl });
      
      const configResult = await configureOpenClaw(instanceUrl, {
        instanceId: instance.id,
        userId,
        gatewayToken,
      });

      if (!configResult.success) {
        logger.warn("OpenClaw configuration failed, but instance is deployed", {
          instanceId: instance.id,
          error: configResult.message,
        });
        // Continue anyway - instance is usable, just needs manual config
      }

      // Step 8: Update instance status
      await db
        .update(instances)
        .set({
          url: instanceUrl,
          status: "ready",
          domainStatus: "ready",
          updatedAt: new Date(),
        })
        .where(eq(instances.id, instance.id));

      logger.info("Instance provisioning complete", { 
        instanceId: instance.id, 
        url: instanceUrl 
      });

      // Step 9: Send welcome email
      if (user?.email && subscription?.plan) {
        await sendInstanceReadyEmail({
          email: user.email,
          instanceUrl,
          customDomain,
          plan: subscription.plan,
        });
      }

      return; // Success!
    } catch (err) {
      lastError = err as Error;
      logger.error(`Provisioning attempt ${attempt + 1}/${INSTANCE_PROVISION_MAX_RETRIES} failed`, {
        instanceId: instance.id,
        error: (err as Error).message,
      });

      if (attempt < INSTANCE_PROVISION_MAX_RETRIES - 1) {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }

  // All retries failed
  await db
    .update(instances)
    .set({
      status: "error",
      domainStatus: "error",
      errorMessage: lastError?.message ?? "Unknown provisioning error",
      updatedAt: new Date(),
    })
    .where(eq(instances.id, instance.id));

  // Send error email
  if (user?.email) {
    await sendInstanceReadyEmail({
      email: user.email,
      instanceUrl: "",
      customDomain: "",
      plan: subscription?.plan ?? "unknown",
    });
  }

  logger.error("Instance provisioning failed after all retries", { instanceId: instance.id });
}
