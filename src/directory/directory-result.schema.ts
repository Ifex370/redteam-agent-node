export type DirectoryResourceType = "directory" | "file" | "endpoint" | "redirect" | "unknown";

export type ConfidenceLevel = "low" | "medium" | "high";

export type DirectoryScanStatus = "queued" | "running" | "completed" | "partial" | "failed";

export type DirectoryScanContext = {
  scanId: string;
  target: string;
  startedAt: string;
};

export type DirectoryScanEntry = {
  id: string;
  url: string;
  path: string;
  resourceType: DirectoryResourceType;
  method: string;
  statusCode?: number;
  contentLength?: number;
  contentType?: string;
  redirectLocation?: string;
  depth?: number;
  sources: string[];
  firstDiscoveredBy: string;
  confidence: ConfidenceLevel;
  requiresAuthentication: boolean;
  metadata: Record<string, unknown>;
};

export type DirectoryScanError = {
  tool: string;
  code: string;
  message: string;
};

export type DirectoryScanResponse = {
  scanId: string;
  scanType: "directory-enumeration";
  target: string;
  status: DirectoryScanStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  toolsRun: string[];
  summary: {
    totalDiscovered: number;
    directories: number;
    files: number;
    endpoints: number;
    redirects: number;
    errors: number;
  };
  results: DirectoryScanEntry[];
  errors: DirectoryScanError[];
};

export type DirectoryScannerAdapter = {
  toolName: string;
  normalize(rawOutput: unknown, context: DirectoryScanContext): DirectoryScanEntry[];
};
