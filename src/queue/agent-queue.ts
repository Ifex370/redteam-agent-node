import { Queue } from "bullmq";
import { nanoid } from "nanoid";
import { createRedisOptions } from "./connection.js";
import { EngagementRunInput } from "../domain/schemas.js";

export const agentQueueName = "agent-queue";

export function createAgentQueue() {
  return new Queue<EngagementRunInput>(agentQueueName, {
    connection: createRedisOptions(),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: false,
      removeOnFail: false
    }
  });
}

export async function enqueueRun(input: EngagementRunInput) {
  const queue = createAgentQueue();
  const runId = input.runId ?? `run_${nanoid(12)}`;
  const job = await queue.add(
    "agent-run",
    { ...input, runId },
    {
      jobId: runId
    }
  );
  await queue.close();
  return { runId, jobId: job.id };
}
