import { EngagementRunInput } from "../domain/schemas.js";

const deniedHosts = new Set([
  "169.254.169.254",
  "metadata.google.internal"
]);

export function assertRunIsAllowed(input: EngagementRunInput) {
  if (!input.policy.authorized) {
    throw new Error("Run refused: authorization attestation is required.");
  }

  for (const target of input.targets) {
    if (target.url) {
      const parsed = new URL(target.url);
      const host = parsed.hostname.toLowerCase();
      if (deniedHosts.has(host) || host.endsWith(".gov") || host.endsWith(".mil")) {
        throw new Error(`Run refused: target host is denied (${host}).`);
      }

      if (target.kind === "repo") {
        if (parsed.protocol !== "https:") {
          throw new Error("Run refused: repo targets must use HTTPS URLs.");
        }
        if (parsed.username || parsed.password) {
          throw new Error("Run refused: credentials in repo URLs are not allowed.");
        }
        if (!host.endsWith("github.com")) {
          throw new Error(`Run refused: only github.com repo targets are enabled for this MVP (${host}).`);
        }
      }
    }

    if (target.fetchUrl) {
      const parsed = new URL(target.fetchUrl);
      const host = parsed.hostname.toLowerCase();
      if (deniedHosts.has(host) || host.endsWith(".gov") || host.endsWith(".mil")) {
        throw new Error(`Run refused: fetchUrl host is denied (${host}).`);
      }
    }
  }

  if (input.template === "web-sast") {
    const unsupported = input.targets.filter((target) => target.kind !== "local_path" && target.kind !== "repo");
    if (unsupported.length > 0) {
      throw new Error("MVP web-sast only supports local_path and repo targets.");
    }
  }

  if (input.template === "container-image" || input.template === "container-scan") {
    const unsupported = input.targets.filter((target) => target.kind !== "container_image");
    if (unsupported.length > 0) {
      throw new Error("Container scan only supports container_image targets.");
    }
  }
}
