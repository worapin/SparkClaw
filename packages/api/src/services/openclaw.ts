import { logger } from "../lib/logger.js";
import { getEnv } from "@sparkclaw/shared";

// OpenClaw API types
interface OpenClawConfig {
  instanceId: string;
  userId: string;
  gatewayToken: string;
}

interface OpenClawSetupResponse {
  success: boolean;
  message?: string;
}

// Configure OpenClaw instance after deployment
export async function configureOpenClaw(
  instanceUrl: string,
  config: OpenClawConfig,
): Promise<OpenClawSetupResponse> {
  const env = getEnv();
  
  try {
    // Call OpenClaw setup endpoint
    const response = await fetch(`${instanceUrl}/api/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.gatewayToken}`,
      },
      body: JSON.stringify({
        instanceId: config.instanceId,
        userId: config.userId,
        // Default LLM configuration via Prism
        llm: {
          provider: "prism",
          baseUrl: process.env.PRISM_BASE_URL,
          apiKey: process.env.PRISM_API_KEY,
        },
        // Enable default channels
        channels: ["telegram", "discord", "web"],
        // Set up admin access
        admin: {
          enabled: true,
          secret: config.gatewayToken,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error("OpenClaw setup failed", { 
        instanceUrl, 
        status: response.status, 
        error 
      });
      return { success: false, message: error };
    }

    const result = await response.json() as { message?: string };
    logger.info("OpenClaw configured successfully", { instanceUrl, instanceId: config.instanceId });
    
    return { success: true, message: result.message };
  } catch (error) {
    logger.error("OpenClaw configuration error", { 
      instanceUrl, 
      error: (error as Error).message 
    });
    return { success: false, message: (error as Error).message };
  }
}

// Check if OpenClaw instance is healthy
export async function checkOpenClawHealth(instanceUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${instanceUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Wait for OpenClaw to be ready
export async function waitForOpenClawReady(
  instanceUrl: string,
  maxAttempts: number = 12,
  intervalMs: number = 10000,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const isHealthy = await checkOpenClawHealth(instanceUrl);
    if (isHealthy) {
      logger.info("OpenClaw instance is ready", { instanceUrl, attempts: i + 1 });
      return true;
    }
    
    logger.info("Waiting for OpenClaw to be ready", { 
      instanceUrl, 
      attempt: i + 1, 
      maxAttempts 
    });
    
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  logger.error("OpenClaw instance failed to become ready", { instanceUrl });
  return false;
}
