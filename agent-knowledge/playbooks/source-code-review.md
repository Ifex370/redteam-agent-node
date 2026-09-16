# Source Code Review Playbook

Use this playbook for repository-based source code analysis.

## Required Inputs

- Repository URL or uploaded source artifact.
- Branch, commit, or tag if applicable.
- Language/framework hints when available.
- Whether full history scanning is allowed.

## Default Flow

1. Clone or unpack the source inside the run workspace.
2. Run Semgrep for SAST.
3. Run CodeQL when the language is supported.
4. Run TruffleHog when secrets scanning is requested or full history is allowed.
5. Run dependency and IaC tools if relevant files are detected.
6. Normalize findings and remove obvious duplicates.

## Checks

- Injection risks.
- Authentication and authorization mistakes.
- Hardcoded secrets.
- Insecure cryptography.
- Dangerous deserialization.
- Unsafe file handling.
- Framework-specific misconfigurations.

## Follow-Up

Ask the user for build instructions only when static analysis requires dependency resolution or generated code.
