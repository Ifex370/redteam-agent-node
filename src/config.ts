import { config as loadEnv } from "dotenv";
import { join, resolve } from "node:path";

loadEnv();

const artifactRoot = resolve(process.env.ARTIFACT_ROOT ?? "./artifacts");

export const appConfig = {
  redis: {
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port: Number(process.env.REDIS_PORT ?? "6379")
  },
  api: {
    host: process.env.API_HOST ?? "127.0.0.1",
    port: Number(process.env.API_PORT ?? "4400"),
    internalSecret: process.env.REDTEAM_AGENT_SECRET ?? process.env.INTERNAL_AGENT_SECRET ?? ""
  },
  artifactRoot,
  workerConcurrency: Number(process.env.WORKER_CONCURRENCY ?? "1"),
  runTimeoutMs: Number(process.env.RUN_TIMEOUT_MS ?? "900000"),
  dockerNetwork: process.env.DOCKER_NETWORK ?? "none",
  codeql: {
    cliPath: process.env.CODEQL_CLI_PATH ?? "codeql"
  },
  trivy: {
    cacheRoot: resolve(process.env.TRIVY_CACHE_ROOT ?? join(artifactRoot, "_tool-cache", "trivy"))
  },
  grype: {
    cacheRoot: resolve(process.env.GRYPE_CACHE_ROOT ?? join(artifactRoot, "_tool-cache", "grype"))
  },
  mobsf: {
    baseUrl: process.env.MOBSF_BASE_URL ?? "http://127.0.0.1:18000",
    apiKey: process.env.MOBSF_API_KEY ?? "",
    maxUploadBytes: Number(process.env.MOBSF_MAX_UPLOAD_BYTES ?? String(500 * 1024 * 1024))
  },
  llm: {
    enabled: process.env.AGENT_LLM_ENABLED === "true",
    model: process.env.AGENT_LLM_MODEL ?? "gpt-5-mini",
    hasApiKey: Boolean(process.env.OPENAI_API_KEY)
  }
};
