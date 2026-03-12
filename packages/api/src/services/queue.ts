import { Queue, Worker, Job } from "bullmq";
import { getEnv } from "@sparkclaw/shared";
import { provisionInstance } from "./railway.js";
import { provisionMCWorkspaceForInstance } from "./mission-control.js";
import { logger } from "../lib/logger.js";

// Redis connection config - lazy loaded
let _redisConfig: { host: string; port: number } | { url: string } | null = null;

const getRedisConfig = () => {
  if (_redisConfig) return _redisConfig;
  const env = getEnv();
  if (env.REDIS_URL) {
    _redisConfig = { url: env.REDIS_URL };
  } else {
    // Default local Redis
    _redisConfig = { host: "localhost", port: 6379 };
  }
  return _redisConfig;
};

// Queue for instance provisioning - lazy loaded
let _instanceQueue: Queue | null = null;

export const getInstanceQueue = () => {
  if (!_instanceQueue) {
    _instanceQueue = new Queue("instance-provisioning", {
      connection: getRedisConfig(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return _instanceQueue;
};

// Job data type
interface ProvisionJobData {
  userId: string;
  subscriptionId: string;
}

// Worker to process provisioning jobs - lazy loaded
let _instanceWorker: Worker<ProvisionJobData> | null = null;

export const getInstanceWorker = () => {
  if (!_instanceWorker) {
    _instanceWorker = new Worker<ProvisionJobData>(
      "instance-provisioning",
      async (job: Job<ProvisionJobData>) => {
        const { userId, subscriptionId } = job.data;
        
        logger.info("Processing instance provisioning job", { 
          jobId: job.id, 
          userId, 
          subscriptionId 
        });

        try {
          await provisionInstance(userId, subscriptionId);
          logger.info("Instance provisioning completed", { jobId: job.id });

          // Create MC workspace after successful provisioning
          await provisionMCWorkspaceForInstance(userId, subscriptionId);
        } catch (error) {
          logger.error("Instance provisioning failed in worker", {
            jobId: job.id,
            error: (error as Error).message
          });
          throw error;
        }
      },
      {
        connection: getRedisConfig(),
        concurrency: 2, // Process 2 jobs concurrently
      }
    );

    // Handle worker events
    _instanceWorker.on("completed", (job: Job<ProvisionJobData>) => {
      logger.info("Job completed", { jobId: job.id });
    });

    _instanceWorker.on("failed", (job: Job<ProvisionJobData> | undefined, err: Error) => {
      logger.error("Job failed", { jobId: job?.id, error: err.message });
    });
  }
  return _instanceWorker;
};

// Helper to add provisioning job to queue
export async function queueInstanceProvisioning(
  userId: string,
  subscriptionId: string
): Promise<Job<ProvisionJobData>> {
  const queue = getInstanceQueue();
  const job = await queue.add("provision-instance", {
    userId,
    subscriptionId,
  });

  logger.info("Instance provisioning queued", { 
    jobId: job.id, 
    userId, 
    subscriptionId 
  });

  return job;
}

// Initialize worker (call this after env validation)
export function initWorker() {
  getInstanceWorker();
  logger.info("Queue worker initialized");
}

// Graceful shutdown
export async function closeQueue(): Promise<void> {
  if (_instanceQueue) await _instanceQueue.close();
  if (_instanceWorker) await _instanceWorker.close();
  logger.info("Queue and worker closed");
}
