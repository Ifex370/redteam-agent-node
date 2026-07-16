export type PluginStatus = "available" | "planned" | "external";

export type SynapDomePlugin = {
  id: string;
  name: string;
  category: string;
  stage: "server-tool" | "legacy-client-plugin" | "external-integration";
  status: PluginStatus;
  template?: string;
  tool?: string;
  targetKind?: string;
  description: string;
  requiredInputs: Array<{
    key: string;
    label: string;
    description: string;
    secret?: boolean;
  }>;
  samplePolicyTools?: string[];
  artifacts: string[];
};

export const synapDomePlugins: SynapDomePlugin[] = [
  {
    id: "supply-chain.semgrep",
    name: "Semgrep",
    category: "Supply Chain / Source Code Analysis",
    stage: "server-tool",
    status: "available",
    template: "web-sast",
    tool: "semgrep",
    targetKind: "repo",
    description: "Static code analysis for source repositories using SynapDome rules and Semgrep SARIF output.",
    requiredInputs: [
      { key: "targets[0].url", label: "GitHub repository URL", description: "HTTPS GitHub URL for the repository to scan." },
      { key: "targets[0].branch", label: "Branch", description: "Optional branch. If missing or invalid, the server falls back to the repository default branch." }
    ],
    samplePolicyTools: ["semgrep"],
    artifacts: ["tool-outputs/semgrep/semgrep.sarif", "exports/synapdome-export.json"]
  },
  {
    id: "supply-chain.trufflehog",
    name: "TruffleHog",
    category: "Supply Chain / Source Code Analysis",
    stage: "server-tool",
    status: "available",
    template: "secrets-scan",
    tool: "trufflehog",
    targetKind: "repo",
    description: "Secret scanning across repository history where possible.",
    requiredInputs: [
      { key: "targets[0].url", label: "GitHub repository URL", description: "HTTPS GitHub URL for the repository to scan." }
    ],
    samplePolicyTools: ["trufflehog"],
    artifacts: ["tool-outputs/trufflehog/trufflehog.jsonl", "exports/synapdome-export.json"]
  },
  {
    id: "supply-chain.codeql",
    name: "CodeQL",
    category: "Supply Chain / Source Code Analysis",
    stage: "server-tool",
    status: "available",
    template: "web-sast",
    tool: "codeql",
    targetKind: "repo",
    description: "CodeQL analysis for supported languages using the locally installed CodeQL CLI.",
    requiredInputs: [
      { key: "targets[0].url", label: "GitHub repository URL", description: "HTTPS GitHub URL for the repository to scan." }
    ],
    samplePolicyTools: ["codeql"],
    artifacts: ["tool-outputs/codeql/codeql.sarif", "exports/synapdome-export.json"]
  },
  {
    id: "applications.web.directory-enumeration",
    name: "Directory Enumeration",
    category: "Applications / Web",
    stage: "server-tool",
    status: "available",
    template: "directory-enumeration",
    tool: "directory-enumeration",
    targetKind: "url",
    description: "Unified directory and endpoint discovery using Feroxbuster and ffuf with one canonical result contract.",
    requiredInputs: [
      { key: "targets[0].url", label: "Target URL", description: "Authorized HTTP or HTTPS web application URL." },
      { key: "policy.allowedDomains", label: "Allowed domains", description: "Must include the target hostname or parent domain." }
    ],
    samplePolicyTools: ["feroxbuster", "ffuf"],
    artifacts: [
      "exports/directory-results.json",
      "tool-outputs/feroxbuster/feroxbuster.jsonl",
      "tool-outputs/ffuf/ffuf.json"
    ]
  },
  {
    id: "applications.web.nuclei",
    name: "Nuclei",
    category: "Applications / Web",
    stage: "server-tool",
    status: "available",
    template: "web-dast",
    tool: "nuclei",
    targetKind: "url",
    description: "Template-driven web vulnerability scanning for an explicitly authorized URL.",
    requiredInputs: [
      { key: "targets[0].url", label: "Target URL", description: "Authorized HTTP or HTTPS web application URL." },
      { key: "policy.allowedDomains", label: "Allowed domains", description: "Must include the target hostname or parent domain." }
    ],
    samplePolicyTools: ["nuclei"],
    artifacts: ["tool-outputs/nuclei/nuclei.jsonl", "exports/synapdome-export.json"]
  },
  {
    id: "applications.web.zap",
    name: "ZAP Baseline",
    category: "Applications / Web",
    stage: "server-tool",
    status: "available",
    template: "web-dast",
    tool: "zap",
    targetKind: "url",
    description: "OWASP ZAP baseline scan for passive web application findings.",
    requiredInputs: [
      { key: "targets[0].url", label: "Target URL", description: "Authorized HTTP or HTTPS web application URL." },
      { key: "policy.allowedDomains", label: "Allowed domains", description: "Must include the target hostname or parent domain." }
    ],
    samplePolicyTools: ["zap"],
    artifacts: ["tool-outputs/zap/zap-report.json", "tool-outputs/zap/zap-report.html", "exports/synapdome-export.json"]
  },
  {
    id: "applications.web.burp-legacy",
    name: "Burp Suite Legacy Plugin",
    category: "Applications / Web",
    stage: "legacy-client-plugin",
    status: "available",
    description: "Packaged client-side Burp extension for sending selected proxy/sitemap traffic to SynapDome as artifacts for follow-up scans.",
    requiredInputs: [
      { key: "artifact.fetchUrl", label: "Signed artifact URL", description: "Signed JSON/HAR/XML export URL generated by SynapDome." },
      { key: "metadata.source", label: "Source", description: "Use burp-suite." }
    ],
    artifacts: [
      "plugins/legacy/burp-suite/plugin-manifest.json",
      "release-packages/synapdome-burp-extension-v0.1.0.jar"
    ]
  },
  {
    id: "applications.browser-legacy",
    name: "Browser Traffic Legacy Plugin",
    category: "Applications / Web/API",
    stage: "legacy-client-plugin",
    status: "available",
    description: "Packaged browser extension for capturing authorized request metadata and sending browser evidence to SynapDome.",
    requiredInputs: [
      { key: "artifact.fetchUrl", label: "Signed HAR URL", description: "Signed HAR export URL generated by SynapDome." },
      { key: "metadata.source", label: "Source", description: "Use browser-extension." }
    ],
    artifacts: [
      "plugins/legacy/browser-extension/plugin-manifest.json",
      "release-packages/synapdome-browser-extension-v0.1.0.zip"
    ]
  }
];

export const roadmapStatus = {
  "Supply Chain": "closed",
  "Supply Chain / Source Code Analysis / Semgrep": "closed",
  "Supply Chain / Source Code Analysis / TruffleHog": "closed",
  "Supply Chain / Source Code Analysis / CodeQL": "closed",
  "Supply Chain / Dependency Analysis / Trivy": "closed",
  "Supply Chain / Dependency Analysis / Grype": "closed",
  "Supply Chain / Infrastructure as Code / Checkov": "closed",
  "Supply Chain / Infrastructure as Code / tfsec": "closed",
  "Supply Chain / Infrastructure as Code / Terrascan": "closed",
  "Applications / Web / Nuclei": "closed",
  "Applications / Web / ZAP": "closed",
  "Applications / Web / Directory Enumeration": "closed",
  "Applications / Web / Burp": "packaged-mvp-available",
  "Applications / Web / Browser Extension": "packaged-mvp-available",
  "Applications / Mobile / Android / MobSF": "closed",
  "Applications / Mobile / iOS / MobSF": "closed"
} as const;
