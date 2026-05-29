import { createRedisConnection } from "../queue/connection.js";

export type RunEvent = {
  runId: string;
  type: "status" | "log" | "finding" | "artifact" | "error" | "complete";
  message: string;
  data?: unknown;
  ts: string;
};

export function runChannel(runId: string) {
  return `agent-run:${runId}:events`;
}

export async function publishRunEvent(event: Omit<RunEvent, "ts">) {
  const redis = createRedisConnection();
  const payload: RunEvent = { ...event, ts: new Date().toISOString() };
  await redis.publish(runChannel(event.runId), JSON.stringify(payload));
  await redis.quit();
}
