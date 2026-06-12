import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { publishRunEvent } from "../events/run-events.js";

export async function downloadArtifact(params: {
  runId: string;
  url: string;
  destination: string;
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

  await pipeline(response.body, createWriteStream(params.destination));
  await publishRunEvent({
    runId: params.runId,
    type: "artifact",
    message: `Downloaded signed artifact`
  });

  return params.destination;
}
