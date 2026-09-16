# Evidence Handling

The agent should preserve enough evidence to support each finding without collecting unnecessary sensitive data.

## Store

- Tool logs.
- Screenshots.
- Generated scripts.
- Request and response metadata.
- Redacted snippets that demonstrate the issue.
- Approval decisions.
- Timestamps and run IDs.

## Redact

- Passwords.
- Session cookies.
- API keys.
- Access tokens.
- Personal data.
- Payment card data.

## Evidence Quality

Each finding should include:

- What was observed.
- Why it matters.
- Where it was observed.
- How it was validated.
- Suggested remediation.
