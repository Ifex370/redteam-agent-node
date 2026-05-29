import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { engagementRunSchema } from "../domain/schemas.js";
import { enqueueRun } from "../queue/agent-queue.js";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run submit:sample -- <engagement.json>");
  process.exit(1);
}

const raw = await readFile(resolve(file), "utf8");
const input = engagementRunSchema.parse(JSON.parse(raw));
const result = await enqueueRun(input);

console.log(JSON.stringify(result, null, 2));
