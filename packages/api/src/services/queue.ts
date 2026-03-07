import { Queue, Worker, Job } from "bullmq";
import { getEnv } from "@sparkclaw/shared";
import { provisionInstance } from "./railway.js";
import { logger } from "../lib/logger.js";

// Redis connection config
const getRedisConfig = () => {
  const env = getEnv();
  if (env.REDIS_URL) {
    return { url: env.REDIS_URL };
  }
  // Default local Redis
  return { host: "localhost", port: 6379 };
};

// Queue for instance provisioning
export const instanceQueue = new Queue("instance-provisioning", {
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

// Job data type
interface ProvisionJobData {
  userId: string;
  subscriptionId: string;
}

// Worker to process provisioning jobs
export const instanceWorker = new Worker<ProvisionJobData>(
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
instanceWorker.on("completed", (job: Job<ProvisionJobData>) => {
  logger.info("Job completed", { jobId: job.id });
});

instanceWorker.on("failed", (job: Job<ProvisionJobData> | undefined, err: Error) => {
  logger.error("Job failed", { jobId: job?.id, error: err.message });
});

// Helper to add provisioning job to queue
export async function queueInstanceProvisioning(
  userId: string,
  subscriptionId: string
): Promise<Job<ProvisionJobData>> {
  const job = await instanceQueue.add("provision-instance", {
    userId,
    subscriptionId,
  }, {
    jobId: `provision-${subscriptionId}`, // Deduplicate by subscription
  });

  logger.info("Instance provisioning queued", { 
    jobId: job.id, 
    userId, 
    subscriptionId 
  });

  return job;
}

// Graceful shutdown
export async function closeQueue(): Promise<void> {
  await instanceQueue.close();
  await instanceWorker.close();
  logger.info("Queue and worker closed");
}
