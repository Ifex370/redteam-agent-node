# Infrastructure as Code Review Playbook

Use this playbook for Terraform, Kubernetes manifests, CloudFormation, Docker Compose, Helm, or other infrastructure configuration.

## Default Flow

1. Identify IaC file types.
2. Run Checkov, tfsec, and Terrascan when supported.
3. Group findings by cloud service, severity, and affected resource.
4. De-duplicate overlapping checks.
5. Explain business impact in cloud/security language.

## Checks

- Public exposure.
- Weak encryption settings.
- Overly permissive IAM.
- Missing logging and monitoring.
- Insecure security group or network rules.
- Public storage buckets or registries.
- Kubernetes privilege and network-policy risks.
