import { Worker } from "bullmq";
import { agentQueueName } from "../queue/agent-queue.js";
import { createRedisOptions } from "../queue/connection.js";
import { appConfig } from "../config.js";
import { EngagementRunInput } from "../domain/schemas.js";
import { processRun } from "../agent/orchestrator.js";

const worker = new Worker<EngagementRunInput>(
  agentQueueName,
  async (job) => processRun(job.data),
  {
    connection: createRedisOptions(),
    concurrency: appConfig.workerConcurrency,
    lockDuration: appConfig.runTimeoutMs + 60_000
  }
);

worker.on("ready", () => {
  console.log(`Agent worker listening on ${agentQueueName} with concurrency ${appConfig.workerConcurrency}`);
});

worker.on("failed", (job, error) => {
  console.error(`Run ${job?.id ?? "unknown"} failed:`, error.message);
});

process.on("SIGINT", async () => {
  await worker.close();
  process.exit(0);
});
