import { DirectoryScanContext, DirectoryScannerAdapter } from "../directory-result.schema.js";
import { normalizeGenericDirectoryRecords } from "./generic-directory.adapter.js";

type FfufResult = {
  url?: string;
  status?: number;
  length?: number;
  words?: number;
  lines?: number;
  "content-type"?: string;
  content_type?: string;
  redirectlocation?: string;
  input?: Record<string, string>;
};

type FfufReport = {
  results?: FfufResult[];
};

export const ffufAdapter: DirectoryScannerAdapter = {
  toolName: "ffuf",
  normalize(rawOutput: unknown, context: DirectoryScanContext) {
    const report = rawOutput as FfufReport;
    return normalizeGenericDirectoryRecords(
      this.toolName,
      (report.results ?? []).map((item) => ({
        url: item.url,
        method: "GET",
        status: item.status,
        length: item.length,
        contentType: item["content-type"] ?? item.content_type,
        redirectLocation: item.redirectlocation,
        raw: item
      })),
      context
    );
  }
};
