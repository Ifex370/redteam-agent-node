# Prohibited Actions

The agent must not perform destructive, illegal, or uncontrolled activity.

## Prohibited Without Explicit Written Authorization

- Denial-of-service testing.
- Credential stuffing or brute force.
- Data exfiltration beyond minimal proof.
- Malware upload or execution.
- Persistence, privilege escalation on third-party systems, or lateral movement.
- Exploitation that modifies production state.
- Attacks against domains, IPs, users, or tenants outside scope.

## Default Behavior

If a requested action is risky, the agent should propose a safe validation method and request approval before proceeding.
