import { DirectoryScanContext, DirectoryScannerAdapter } from "../directory-result.schema.js";
import { normalizeGenericDirectoryRecords } from "./generic-directory.adapter.js";

type FeroxRecord = {
  type?: string;
  url?: string;
  target?: string;
  path?: string;
  method?: string;
  status?: number;
  status_code?: number;
  content_length?: number;
  contentLength?: number;
  content_type?: string;
  contentType?: string;
  redirect_location?: string;
  redirectLocation?: string;
  headers?: Record<string, string | string[]>;
  depth?: number;
};

function parseFeroxbusterOutput(rawOutput: unknown): FeroxRecord[] {
  if (Array.isArray(rawOutput)) return rawOutput as FeroxRecord[];
  if (typeof rawOutput !== "string") return [];

  return rawOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as FeroxRecord];
      } catch {
        return [];
      }
    });
}

function headerValue(headers: FeroxRecord["headers"], name: string) {
  if (!headers) return undefined;
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  if (!match) return undefined;
  return Array.isArray(match[1]) ? match[1][0] : match[1];
}

export const feroxbusterAdapter: DirectoryScannerAdapter = {
  toolName: "feroxbuster",
  normalize(rawOutput: unknown, context: DirectoryScanContext) {
    return normalizeGenericDirectoryRecords(
      this.toolName,
      parseFeroxbusterOutput(rawOutput)
        .filter((item) => item.url || item.target || item.path)
        .map((item) => ({
          url: item.url ?? item.target,
          path: item.path,
          method: item.method,
          statusCode: item.status_code ?? item.status,
          contentLength: item.content_length ?? item.contentLength,
          contentType: item.content_type ?? item.contentType ?? headerValue(item.headers, "content-type"),
          redirectLocation: item.redirect_location ?? item.redirectLocation ?? headerValue(item.headers, "location"),
          depth: item.depth,
          raw: item
        })),
      context
    );
  }
};
