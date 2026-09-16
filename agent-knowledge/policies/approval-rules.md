# Approval Rules

The agent must request user approval before executing active or potentially state-changing actions.

## Always Require Approval

- Submitting login forms.
- Using credentials, tokens, cookies, or API keys.
- Sending payment, checkout, funds movement, order, invoice, or subscription requests.
- Running fuzzing, brute force, forced browsing, or high-volume enumeration.
- Uploading files to a target application.
- Modifying account, profile, admin, billing, or tenant settings.
- Running generated scripts.
- Running shell commands beyond a predefined safe allowlist.
- Accessing a target outside the declared scope.

## Approval Prompt Must Include

- Target.
- Tool or script to run.
- Expected actions.
- Maximum runtime.
- Scope boundaries.
- Evidence to be collected.

## Approval Result

The system should store approval decisions as engagement artifacts so later reports can show what was authorized.
