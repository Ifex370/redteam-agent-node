import { z } from "zod";

export const targetSchema = z.object({
  kind: z.enum(["repo", "local_path", "url", "container_image", "mobile_app"]),
  url: z.string().url().optional(),
  fetchUrl: z.string().url().optional(),
  path: z.string().optional(),
  image: z.string().optional(),
  branch: z.string().optional(),
  fileName: z.string().optional()
});

export const providedInputSchema = z.record(z.unknown()).default({});

export const callbackSchema = z.object({
  url: z.string().url(),
  runId: z.string().min(1),
  tenantId: z.string().min(1)
});

export const policySchema = z.object({
  authorized: z.literal(true),
  allowedDomains: z.array(z.string()).default([]),
  maxDurationMinutes: z.number().int().positive().max(120).default(15),
  network: z.enum(["none", "restricted", "host"]).default("none"),
  tools: z.array(z.string()).default(["semgrep"])
});

export const engagementRunSchema = z.object({
  tenantId: z.string().min(1),
  engagementId: z.string().min(1),
  runId: z.string().min(1).optional(),
  template: z.enum(["web-sast", "web-scan", "web-dast", "secrets-scan", "dependency-scan", "iac-scan", "mobile-scan", "container-image", "container-scan"]),
  targets: z.array(targetSchema).min(1),
  policy: policySchema,
  callback: callbackSchema.optional(),
  providedInputs: providedInputSchema.optional()
});

export type EngagementRunInput = z.infer<typeof engagementRunSchema>;

export type NormalizedFinding = {
  id: string;
  source: string;
  tool: string;
  summary?: Record<string, unknown>;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  asset: string;
  location?: string;
  evidence: string;
  remediation?: string;
  raw?: unknown;
};

export type RunStatus =
  | "queued"
  | "validating"
  | "planning"
  | "awaiting_input"
  | "running_tool"
  | "analyzing_results"
  | "normalizing"
  | "succeeded"
  | "failed"
  | "cancelled";

export type RunStep = {
  stepId: string;
  tool: string;
  status: "planned" | "running" | "succeeded" | "failed" | "skipped" | "awaiting_input";
  reason: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  findingCount?: number;
  artifacts?: string[];
};

export type InputRequest = {
  id: string;
  status: "open" | "resolved";
  question: string;
  requiredFields: Array<{
    key: string;
    label: string;
    secret?: boolean;
    description?: string;
  }>;
  resumeAction: string;
  createdAt: string;
  resolvedAt?: string;
};

export type RunSummary = {
  runId: string;
  tenantId: string;
  engagementId: string;
  template: EngagementRunInput["template"];
  status: RunStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  steps: RunStep[];
  inputRequests: InputRequest[];
  toolsRun: Array<{
    name: string;
    image: string;
    exitCode: number | null;
    startedAt: string;
    completedAt: string;
  }>;
  findingCount: number;
  findings: NormalizedFinding[];
  artifacts: string[];
  synapdomeExportKey?: string;
  error?: string;
};
