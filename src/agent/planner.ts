import { nanoid } from "nanoid";
import { EngagementRunInput, RunStep } from "../domain/schemas.js";
import { InputRequiredError } from "./input-required.js";

export type PlannedRun = {
  targetPath?: string;
  urlTarget?: {
    url: string;
  };
  repoTarget?: {
    url: string;
    branch?: string;
    fullHistory?: boolean;
  };
  containerTarget?: {
    fetchUrl?: string;
    image?: string;
  };
  mobileTarget?: {
    fetchUrl: string;
    fileName: string;
  };
  steps: RunStep[];
};

const supportedMobileExtensions = [".apk", ".aab", ".apks", ".xapk", ".ipa"];

function mobileScanSteps(input: EngagementRunInput): RunStep[] {
  const requestedTools = input.policy.tools.length > 0 ? input.policy.tools : ["mobsf"];
  const supportedTools = requestedTools.filter((tool) => tool === "mobsf");
  if (supportedTools.length === 0) {
    throw new Error("No supported mobile-scan tools requested. Supported tools: mobsf.");
  }
  return supportedTools.map((tool) => ({
    stepId: `step_${nanoid(10)}`,
    tool,
    status: "planned",
    reason: "A signed mobile application artifact was supplied, so download it and run MobSF static analysis."
  }));
}

function webSastSteps(input: EngagementRunInput, targetKind: "local_path" | "repo"): RunStep[] {
  const defaultTools = input.template === "secrets-scan" ? ["trufflehog"] : ["semgrep"];
  const requestedTools = input.template === "secrets-scan"
    ? ["trufflehog"]
    : input.policy.tools.length > 0 ? input.policy.tools : defaultTools;
  const supportedTools = requestedTools.filter((tool) => tool === "semgrep" || tool === "trufflehog" || tool === "codeql");

  if (supportedTools.length === 0) {
    throw new Error(`No supported ${input.template} tools requested. Supported tools: semgrep, trufflehog, codeql.`);
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

function dependencyScanSteps(input: EngagementRunInput, targetKind: "local_path" | "repo"): RunStep[] {
  const requestedTools = input.policy.tools.length > 0 ? input.policy.tools : ["trivy"];
  const supportedTools = requestedTools.filter((tool) => tool === "trivy" || tool === "grype");

  if (supportedTools.length === 0) {
    throw new Error("No supported dependency-scan tools requested. Supported tools: trivy, grype.");
  }

  return supportedTools.map((tool) => ({
    stepId: `step_${nanoid(10)}`,
    tool,
    status: "planned",
    reason: targetKind === "repo"
      ? `Repository source code was supplied, so run ${tool} dependency analysis after cloning.`
      : `Local source path was supplied, so run ${tool} dependency analysis.`
  }));
}

function iacScanSteps(input: EngagementRunInput, targetKind: "local_path" | "repo"): RunStep[] {
  const requestedTools = input.policy.tools.length > 0 ? input.policy.tools : ["checkov"];
  const supportedTools = requestedTools.filter((tool) => tool === "checkov" || tool === "tfsec" || tool === "terrascan");
  if (supportedTools.length === 0) throw new Error("No supported iac-scan tools requested. Supported tools: checkov, tfsec, terrascan.");
  return supportedTools.map((tool) => ({
    stepId: `step_${nanoid(10)}`, tool, status: "planned",
    reason: targetKind === "repo" ? `Repository source code was supplied, so run ${tool} IaC analysis after cloning.` : `Local source path was supplied, so run ${tool} IaC analysis.`
  }));
}

function webScanSteps(input: EngagementRunInput): RunStep[] {
  const requestedTools = input.policy.tools.length > 0 ? input.policy.tools : ["nuclei", "zap"];
  const supportedTools = requestedTools.filter((tool) => tool === "nuclei" || tool === "zap");
  if (supportedTools.length === 0) {
    throw new Error("No supported web-scan tools requested. Supported tools: nuclei, zap.");
  }

  return supportedTools.map((tool) => ({
    stepId: `step_${nanoid(10)}`,
    tool,
    status: "planned",
    reason: `A web URL was supplied, so run ${tool} against the authorized target.`
  }));
}

export function planRun(input: EngagementRunInput): PlannedRun {
  if (input.template === "web-scan") {
    const target = input.targets.find((item) => item.kind === "url");
    if (!target?.url) {
      throw new InputRequiredError({
        id: `input_${nanoid(10)}`,
        status: "open",
        question: "Web application scanning needs a url target.",
        requiredFields: [
          { key: "targets[0].kind", label: "Target type", description: "Use url." },
          { key: "targets[0].url", label: "Authorized web application URL" }
        ],
        resumeAction: "provide_web_url",
        createdAt: new Date().toISOString()
      });
    }

    return {
      urlTarget: { url: target.url },
      steps: webScanSteps(input)
    };
  }

  if (input.template === "web-sast" || input.template === "secrets-scan" || input.template === "dependency-scan" || input.template === "iac-scan") {
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
      repoTarget: target.kind === "repo" && target.url ? {
        url: target.url,
        branch: target.branch,
        fullHistory: input.template === "secrets-scan"
      } : undefined,
      steps: input.template === "dependency-scan"
        ? dependencyScanSteps(input, target.kind as "local_path" | "repo")
        : input.template === "iac-scan"
          ? iacScanSteps(input, target.kind as "local_path" | "repo")
        : webSastSteps(input, target.kind as "local_path" | "repo")
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

  if (input.template === "mobile-scan") {
    const target = input.targets.find((item) => item.kind === "mobile_app");
    if (!target?.fetchUrl) {
      throw new InputRequiredError({
        id: `input_${nanoid(10)}`,
        status: "open",
        question: "Mobile scanning needs a mobile_app target with a signed fetchUrl.",
        requiredFields: [
          { key: "targets[0].kind", label: "Target type", description: "Use mobile_app." },
          { key: "targets[0].fetchUrl", label: "Signed mobile application URL" }
        ],
        resumeAction: "provide_mobile_app",
        createdAt: new Date().toISOString()
      });
    }

    const fileName = target.fileName?.trim() || "application.apk";
    if (!supportedMobileExtensions.some((extension) => fileName.toLowerCase().endsWith(extension))) {
      throw new InputRequiredError({
        id: `input_${nanoid(10)}`,
        status: "open",
        question: "MobSF needs a supported mobile application filename.",
        requiredFields: [{
          key: "targets[0].fileName",
          label: "Artifact filename",
          description: `Use a filename ending in ${supportedMobileExtensions.join(", ")}.`
        }],
        resumeAction: "provide_mobile_app_filename",
        createdAt: new Date().toISOString()
      });
    }

    return {
      mobileTarget: {
        fetchUrl: target.fetchUrl,
        fileName
      },
      steps: mobileScanSteps(input)
    };
  }

  throw new Error(`Unsupported template: ${input.template}`);
}
