import { db, instances } from "@sparkclaw/shared/db";
import {
  INSTANCE_POLL_INTERVAL_MS,
  INSTANCE_POLL_MAX_ATTEMPTS,
  INSTANCE_PROVISION_MAX_RETRIES,
} from "@sparkclaw/shared/constants";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

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

async function createRailwayService(instanceId: string) {
  const projectId = process.env.RAILWAY_PROJECT_ID!;

  const result = await railwayRequest(
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

  return result.data!.serviceCreate.id as string;
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
  const [instance] = await db
    .insert(instances)
    .values({
      userId,
      subscriptionId,
      railwayProjectId: process.env.RAILWAY_PROJECT_ID!,
      status: "pending",
    })
    .returning();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < INSTANCE_PROVISION_MAX_RETRIES; attempt++) {
    try {
      const serviceId = await createRailwayService(instance.id);

      await db
        .update(instances)
        .set({ railwayServiceId: serviceId, updatedAt: new Date() })
        .where(eq(instances.id, instance.id));

      logger.info("Railway service created", { instanceId: instance.id, serviceId });

      // Create a domain for the service
      const environmentId = await getProjectEnvironmentId();
      const createdDomain = await createServiceDomain(serviceId, environmentId);

      if (createdDomain) {
        await db
          .update(instances)
          .set({
            url: `https://${createdDomain}`,
            status: "ready",
            updatedAt: new Date(),
          })
          .where(eq(instances.id, instance.id));

        logger.info("Instance provisioned", { instanceId: instance.id, url: `https://${createdDomain}` });
        return;
      }

      // Fallback: poll for domain
      for (let poll = 0; poll < INSTANCE_POLL_MAX_ATTEMPTS; poll++) {
        await sleep(INSTANCE_POLL_INTERVAL_MS);

        const domain = await getServiceDomain(serviceId);
        if (domain) {
          await db
            .update(instances)
            .set({
              url: `https://${domain}`,
              status: "ready",
              updatedAt: new Date(),
            })
            .where(eq(instances.id, instance.id));

          logger.info("Instance provisioned via polling", { instanceId: instance.id, url: `https://${domain}` });
          return;
        }
      }

      throw new Error("Deployment polling timeout - domain not available");
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

  await db
    .update(instances)
    .set({
      status: "error",
      errorMessage: lastError?.message ?? "Unknown provisioning error",
      updatedAt: new Date(),
    })
    .where(eq(instances.id, instance.id));

  logger.error("Instance provisioning failed after all retries", { instanceId: instance.id });
}
