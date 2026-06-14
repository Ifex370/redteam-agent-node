import { nanoid } from "nanoid";
import { EngagementRunInput, RunStep } from "../domain/schemas.js";
import { InputRequiredError } from "./input-required.js";

export type PlannedRun = {
  targetPath?: string;
  repoTarget?: {
    url: string;
    branch?: string;
  };
  containerTarget?: {
    fetchUrl?: string;
    image?: string;
  };
  steps: RunStep[];
};

function webSastSteps(input: EngagementRunInput, targetKind: "local_path" | "repo"): RunStep[] {
  const defaultTools = input.template === "secrets-scan" ? ["trufflehog"] : ["semgrep"];
  const requestedTools = input.template === "secrets-scan"
    ? ["trufflehog"]
    : input.policy.tools.length > 0 ? input.policy.tools : defaultTools;
  const supportedTools = requestedTools.filter((tool) => tool === "semgrep" || tool === "trufflehog");

  if (supportedTools.length === 0) {
    throw new Error(`No supported ${input.template} tools requested. Supported tools: semgrep, trufflehog.`);
  }

  return supportedTools.map((tool) => ({
    stepId: `step_${nanoid(10)}`,
    tool,
    status: "planned",
    reason: targetKind === "repo"
      ? `Repository source code was supplied, so run ${tool} after cloning.`
      : `Local source path was supplied, so run ${tool}.`
  }));
}

export function planRun(input: EngagementRunInput): PlannedRun {
  if (input.template === "web-sast" || input.template === "secrets-scan") {
    const target = input.targets.find((item) => item.kind === "local_path" || item.kind === "repo");

    if (!target) {
      throw new InputRequiredError({
        id: `input_${nanoid(10)}`,
        status: "open",
        question: `${input.template} needs either a local source path or an HTTPS GitHub repository URL.`,
        requiredFields: [
          {
            key: "targets[0].kind",
            label: "Target type",
            description: "Use local_path or repo."
          },
          {
            key: "targets[0].url",
            label: "GitHub repository URL",
            description: "Required when target type is repo."
          }
        ],
        resumeAction: "provide_missing_target",
        createdAt: new Date().toISOString()
      });
    }

    if (target.kind === "local_path" && !target.path) {
      throw new InputRequiredError({
        id: `input_${nanoid(10)}`,
        status: "open",
        question: "The local_path target is missing its path.",
        requiredFields: [{ key: "targets[0].path", label: "Local path" }],
        resumeAction: "provide_missing_target_path",
        createdAt: new Date().toISOString()
      });
    }

    if (target.kind === "repo" && !target.url) {
      throw new InputRequiredError({
        id: `input_${nanoid(10)}`,
        status: "open",
        question: "The repo target is missing its GitHub URL.",
        requiredFields: [{ key: "targets[0].url", label: "GitHub repository URL" }],
        resumeAction: "provide_missing_repo_url",
        createdAt: new Date().toISOString()
      });
    }

    return {
      targetPath: target.kind === "local_path" ? target.path : undefined,
      repoTarget: target.kind === "repo" && target.url ? { url: target.url, branch: target.branch } : undefined,
      steps: webSastSteps(input, target.kind as "local_path" | "repo")
    };
  }

  if (input.template === "container-image" || input.template === "container-scan") {
    const target = input.targets.find((item) => item.kind === "container_image");
    if (!target) {
      throw new InputRequiredError({
        id: `input_${nanoid(10)}`,
        status: "open",
        question: "Container scanning needs a container_image target with either fetchUrl or image.",
        requiredFields: [
          { key: "targets[0].kind", label: "Target type", description: "Use container_image." },
          { key: "targets[0].fetchUrl", label: "Signed image tarball URL" }
        ],
        resumeAction: "provide_container_image",
        createdAt: new Date().toISOString()
      });
    }

    if (!target.fetchUrl) {
      throw new InputRequiredError({
        id: `input_${nanoid(10)}`,
        status: "open",
        question: "The container_image target is missing its signed fetchUrl.",
        requiredFields: [
          { key: "targets[0].fetchUrl", label: "Signed image tarball URL" }
        ],
        resumeAction: "provide_container_image_source",
        createdAt: new Date().toISOString()
      });
    }

    return {
      containerTarget: {
        fetchUrl: target.fetchUrl,
        image: target.image
      },
      steps: [
        {
          stepId: `step_${nanoid(10)}`,
          tool: "trivy-image",
          status: "planned",
          reason: target.fetchUrl
            ? "Uploaded container image tarball was supplied, so download it and run Trivy image scanning."
            : "Container image reference was supplied, so run Trivy image scanning."
        }
      ]
    };
  }

  throw new Error(`Unsupported template: ${input.template}`);
}
