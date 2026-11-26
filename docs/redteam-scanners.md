# Scanner and integration inventory

Source of truth: `src/agent/planner.ts`, `src/tools/*.ts`, `src/domain/schemas.ts`. “Implemented” means an adapter exists, not that a fresh production scan passed in this review.

| Area | Template / policy tool IDs | Runtime from current source | Example in `samples/` |
|---|---|---|---|
| SAST | `web-sast` / `semgrep` | `semgrep/semgrep:1.99.0`; bundled rules | `web-sast.engagement.json` |
| Secrets | `secrets-scan` / `trufflehog` | `trufflesecurity/trufflehog:latest`; repo full history in secrets template | `trufflehog-github-secrets-scan.engagement.json` |
| CodeQL | `web-sast` / `codeql` | Host CLI via `CODEQL_CLI_PATH`; JS/TS and Python | `codeql-github-web-sast.engagement.json` |
| Dependencies | `dependency-scan` / `trivy`, `grype` | `aquasec/trivy:0.58.1`, `anchore/grype:v0.114.0` | `trivy-local-dependency-scan.engagement.json`, `grype-local-dependency-scan.engagement.json` |
| IaC | `iac-scan` / `checkov`, `tfsec`, `terrascan` | `bridgecrew/checkov:3.3.0`, `aquasec/tfsec:v1.28.14`, `tenable/terrascan:1.19.9` | `iac-all-tools-local.engagement.json` |
| Container tarball | `container-scan` / `trivy-image` | Same Trivy image; signed `fetchUrl` required | `container-scan-fetchurl.engagement.json` |
| Mobile static | `mobile-scan` / `mobsf` | `opensecurity/mobile-security-framework-mobsf:v4.4.6` service | `mobsf-mobile.engagement.json` |
| Web DAST | `web-dast` / `nuclei`, `zap` | `projectdiscovery/nuclei:v3.3.8`, `ghcr.io/zaproxy/zaproxy:stable` | `web-url-scan.engagement.json` |
| Directory discovery | `directory-enumeration` / `feroxbuster`, `ffuf` | `epi052/feroxbuster:latest`, `parrotsec/ffuf:latest` | `directory-enumeration.engagement.json` |
| Mobile dynamic | Operator workflow, not queued adapter | Android API 35 ARM64, ADB 37.0.1, Frida 17.8.2 | Mobile package instructions |

`web-scan` is a DAST alias; `container-image` is a container template alias. MobSF accepts `.apk`, `.aab`, `.apks`, `.xapk`, `.ipa` in the planner; validate actual analysis support against the installed service. ZAP uses its baseline workflow, not a complete authenticated active/API-spec assessment.

`GET /plugins` currently lists only part of this inventory. `/roadmap` values such as `closed` describe historical implementation tracking, not live deployment or security signoff.

## Installation and scanner readiness

Run `bash scripts/pull-scanner-images.sh` on the Docker worker host. It reads image references from the adapters, pulls them, and writes resolved image digests for review. Do not equate downloading an image with a successful scan. `latest`/`stable` tags remain mutable; approve and pin tested digests in adapters and Compose before reproducible production rollout.

Install a reviewed CodeQL Linux bundle separately and set `CODEQL_CLI_PATH` to its executable. Record the bundle release/checksum and verify language packs are available. The old installer uses an unpinned `latest` Linux x64 download; it is not an ARM installer. Confirm permitted CodeQL use for the intended private/commercial repositories before rollout.

Trivy and Grype need vulnerability database downloads/cache refresh; Checkov, Terrascan, Nuclei and DAST workflows may also need network access. Semgrep and TruffleHog adapters use network `none`, as does tfsec. The worker's `DOCKER_NETWORK` default does not override an adapter's explicit network choice.

MobSF needs its separate service, a private shared API key, persistent volume and sufficient startup time. Compose currently reserves up to 5 GB RAM and 3 CPUs for MobSF. An initial combined worker host sizing assumption is 8 vCPU / 16 GB RAM with concurrency 1; measure actual jobs before increasing concurrency. This is a planning estimate, not a benchmark.

For each template, use an owned test fixture, check terminal status, expected seeded findings, raw artifacts and normalized export. Replace signed URLs and example target domains before submitting. Do not run the entire examples directory against public targets as a smoke test.

## Detailed contracts

Existing handoffs cover [CodeQL](codeql-integration-handoff.md), [Trivy](trivy-dependency-integration-handoff.md), [Grype](grype-dependency-integration-handoff.md), [Checkov](checkov-iac-integration-handoff.md), [tfsec](tfsec-iac-integration-handoff.md), [Terrascan](terrascan-iac-integration-handoff.md), [MobSF](mobsf-mobile-integration-handoff.md), [DAST HTML](dast-html-report-handoff.md) and [directory results](directory-enumeration-handoff.md). Historical host addresses and deployment claims in these documents are not current availability checks.
