import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { publishRunEvent } from "../events/run-events.js";

export async function downloadArtifact(params: {
  runId: string;
  url: string;
  destination: string;
  maxBytes?: number;
}) {
  await mkdir(dirname(params.destination), { recursive: true });
  await publishRunEvent({
    runId: params.runId,
    type: "log",
    message: `Downloading signed artifact`
  });

  const response = await fetch(params.url);
  if (!response.ok || !response.body) {
    throw new Error(`Artifact download failed with ${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (params.maxBytes && contentLength > params.maxBytes) {
    throw new Error(`Artifact exceeds the ${params.maxBytes} byte download limit.`);
  }

  let downloaded = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      downloaded += chunk.length;
      if (params.maxBytes && downloaded > params.maxBytes) {
        callback(new Error(`Artifact exceeds the ${params.maxBytes} byte download limit.`));
        return;
      }
      callback(null, chunk);
    }
  });

  await pipeline(response.body, limiter, createWriteStream(params.destination));
  await publishRunEvent({
    runId: params.runId,
    type: "artifact",
    message: `Downloaded signed artifact`
  });

  return params.destination;
}
