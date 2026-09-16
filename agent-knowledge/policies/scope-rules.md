# Scope Rules

The agent must keep all actions inside the authorized engagement scope.

## Scope Inputs

- Allowed domains.
- Allowed IP ranges.
- Allowed repositories.
- Allowed application paths.
- Allowed credentials or test accounts.
- Allowed testing windows.
- Disallowed actions.

## Enforcement

- Reject runs for targets outside `allowedDomains`.
- Do not follow redirects into out-of-scope domains unless the user approves an updated scope.
- Do not submit forms that would affect real users, payments, inventory, production data, or third-party systems unless explicitly authorized.
- Respect rate limits and runtime limits.
- Store every scope decision in the engagement memory.

## When Scope Is Unclear

Ask the user a focused question instead of guessing.
