# SynapDome Agent Knowledge Base

This folder stores the reusable pentesting knowledge that SynapDome AT gives to the reasoning agent before it plans or executes work.

The goal is to keep the platform's expertise outside any single model. Qwen can use these playbooks today, and another LLM provider can use the same material later.

## Structure

- `playbooks/` contains testing methodology for common assessment types.
- `policies/` contains safety, scope, approval, and evidence-handling rules.
- `examples/` contains structured plans and scripts the reasoning agent can imitate.

## How the Reasoning Agent Should Use This

1. Identify the user's goal and target type.
2. Retrieve the relevant playbook and policy files.
3. Build a structured plan with scope, assumptions, and approval requirements.
4. Execute only approved internal capabilities.
5. Store observations, scripts, screenshots, logs, and findings as engagement artifacts.

## First-Class Rule

The model may reason, plan, and generate scripts, but the platform decides what can run. All active testing must remain bounded by the engagement scope and approval rules.
