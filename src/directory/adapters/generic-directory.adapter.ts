import { createDirectoryEntry } from "../directory-result.normalizer.js";
import { DirectoryScanContext, DirectoryScanEntry, DirectoryScannerAdapter } from "../directory-result.schema.js";

export type GenericDirectoryRecord = {
  url?: string;
  path?: string;
  method?: string;
  status?: number;
  statusCode?: number;
  contentLength?: number;
  length?: number;
  contentType?: string;
  redirectLocation?: string;
  depth?: number;
  raw?: unknown;
};

function urlFromRecord(record: GenericDirectoryRecord, context: DirectoryScanContext) {
  if (record.url) return record.url;
  if (record.path) return new URL(record.path, context.target).toString();
  return undefined;
}

export function normalizeGenericDirectoryRecords(
  toolName: string,
  records: GenericDirectoryRecord[],
  context: DirectoryScanContext
): DirectoryScanEntry[] {
  const entries: DirectoryScanEntry[] = [];
  for (const record of records) {
    const url = urlFromRecord(record, context);
    if (!url) continue;
    entries.push(createDirectoryEntry({
      toolName,
      target: context.target,
      url,
      method: record.method,
      statusCode: record.statusCode ?? record.status,
      contentLength: record.contentLength ?? record.length,
      contentType: record.contentType,
      redirectLocation: record.redirectLocation,
      depth: record.depth,
      metadata: { raw: record.raw ?? record }
    }));
  }
  return entries;
}

export const genericDirectoryAdapter: DirectoryScannerAdapter = {
  toolName: "generic-directory",
  normalize(rawOutput: unknown, context: DirectoryScanContext) {
    return normalizeGenericDirectoryRecords(
      this.toolName,
      Array.isArray(rawOutput) ? rawOutput as GenericDirectoryRecord[] : [],
      context
    );
  }
};
