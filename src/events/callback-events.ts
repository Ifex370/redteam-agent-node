import { appConfig } from "../config.js";
import { EngagementRunInput, InputRequest, NormalizedFinding, RunSummary } from "../domain/schemas.js";

type CallbackKind = "status" | "input_request" | "results" | "error";

function callbackContext(input: EngagementRunInput) {
  return {
    tenantId: input.callback?.tenantId ?? input.tenantId,
    externalRunId: input.callback?.runId ?? input.runId,
    stepTemplateSlug: input.template
  };
}

async function postCallback(input: EngagementRunInput, kind: CallbackKind, payload: Record<string, unknown>) {
  if (!input.callback?.url) return;

  const body = {
    ...callbackContext(input),
    kind,
    ...payload
  };

  try {
    const response = await fetch(input.callback.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Secret": appConfig.api.internalSecret
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`Callback ${kind} failed with ${response.status}: ${text}`);
    }
  } catch (error) {
    console.error(`Callback ${kind} failed:`, error instanceof Error ? error.message : error);
  }
}

export async function sendStatusCallback(input: EngagementRunInput, phase: string, message: string) {
  await postCallback(input, "status", {
    phase,
    message
  });
}

export async function sendInputRequestCallback(input: EngagementRunInput, inputRequest: InputRequest) {
  await postCallback(input, "input_request", {
    inputRequest
  });
}

function callbackFinding(finding: NormalizedFinding) {
  return {
    id: finding.id,
    title: finding.title,
    severity: finding.severity,
    source: finding.source,
    tool: finding.tool,
    category: finding.category,
    location: finding.location,
    evidence: finding.evidence,
    remediation: finding.remediation,
    raw: finding.raw
  };
}

export async function sendResultsCallback(input: EngagementRunInput, summary: RunSummary) {
  const firstTool = summary.toolsRun[0];
  await postCallback(input, "results", {
    status: summary.status,
    summary: {
      tool: firstTool?.name,
      durationMs: summary.durationMs,
      findingCount: summary.findingCount,
      toolsRun: summary.toolsRun.map((tool) => tool.name)
    },
    findings: summary.findings.map(callbackFinding)
  });
}

export async function sendErrorCallback(input: EngagementRunInput, error: string) {
  await postCallback(input, "error", {
    error
  });
}
