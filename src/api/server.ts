import cors from "@fastify/cors";
import Fastify from "fastify";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { nanoid } from "nanoid";
import { appConfig } from "../config.js";
import { readRunSummary, runArtifactDir, writeJsonArtifact } from "../artifacts/artifact-store.js";
import { engagementRunSchema } from "../domain/schemas.js";
import { runChannel } from "../events/run-events.js";
import { createAgentQueue, enqueueRun } from "../queue/agent-queue.js";
import { createRedisConnection } from "../queue/connection.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true }));

app.post("/runs", async (request, reply) => {
  const input = engagementRunSchema.parse(request.body);
  const enqueued = await enqueueRun(input);
  return reply.code(202).send({
    ...enqueued,
    status: "queued",
    streamUrl: `/runs/${enqueued.runId}/stream`
  });
});

app.get("/runs/:runId", async (request, reply) => {
  const { runId } = request.params as { runId: string };
  try {
    return await readRunSummary(runId);
  } catch {
    const queue = createAgentQueue();
    const job = await queue.getJob(runId);
    const state = job ? await job.getState() : "unknown";
    await queue.close();
    return reply.send({ runId, status: state });
  }
});

app.post("/runs/:runId/input", async (request, reply) => {
  const { runId } = request.params as { runId: string };
  const body = request.body as Record<string, unknown>;
  const inputPath = join(runArtifactDir(runId), "input.engagement.json");
  const original = engagementRunSchema.parse(JSON.parse(await readFile(inputPath, "utf8")));
  const resumed = engagementRunSchema.parse({
    ...original,
    runId,
    providedInputs: {
      ...(original.providedInputs ?? {}),
      ...body
    }
  });

  await writeJsonArtifact(runId, `inputs/${Date.now()}-${nanoid(6)}.json`, body);
  await writeJsonArtifact(runId, "input.engagement.json", resumed);

  const queue = createAgentQueue();
  const job = await queue.add("agent-run", resumed, {
    jobId: `${runId}:resume:${nanoid(8)}`
  });
  await queue.close();

  return reply.code(202).send({
    runId,
    jobId: job.id,
    status: "queued",
    streamUrl: `/runs/${runId}/stream`
  });
});

app.get("/runs/:runId/artifacts/*", async (request, reply) => {
  const params = request.params as { runId: string; "*": string };
  const path = join(runArtifactDir(params.runId), params["*"]);
  await stat(path);
  return reply.send(createReadStream(path));
});

app.get("/runs/:runId/stream", async (request, reply) => {
  const { runId } = request.params as { runId: string };
  const redis = createRedisConnection();
  await redis.subscribe(runChannel(runId));

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });
  reply.raw.write(`event: hello\ndata: ${JSON.stringify({ runId })}\n\n`);

  redis.on("message", (_channel: string, message: string) => {
    reply.raw.write(`event: run-event\ndata: ${message}\n\n`);
  });

  request.raw.on("close", async () => {
    await redis.unsubscribe(runChannel(runId));
    await redis.quit();
  });
});

await app.listen({ host: appConfig.api.host, port: appConfig.api.port });
