# SynapDome Red Team — developer handoff

Consolidated 26 November 2026. SynapDome AT is the operator workspace formerly called CyberStrike. This repository also contains the separate scanner execution service and prospect onboarding site.

- **[Deployment guide](docs/redteam-deployment.md)** — install and connect every included module.
- **[Architecture](docs/redteam-architecture.md)** — service boundaries, data flows and outstanding integration.
- **[Scanner inventory](docs/redteam-scanners.md)** — actual adapters, versions, templates and examples.
- [Validation results and remaining checks](docs/redteam-validation.md)
- [SynapDome AT workspace package](deploy/synapdome-ui/README.md)
- [Mobile runner package](deploy/synapdome-ui/mobile/)
- [Scope/PDF/email onboarding](Synap%20AT/ONBOARDING.md)
- [Burp and browser extension installation](docs/legacy-plugin-installation.md)

This is a consolidated source/deployment handoff, not confirmation of production availability. AWS is suspended/unavailable at handoff. Historical IPs and “server ready” statements in older documents are not current deployment evidence. Start with the guides above.

The workspace source is reconstructed from a pinned upstream commit plus the complete reviewed local patch and assets; it is not vendored as a second source tree. Runtime credentials, APKs, emulator data, customer evidence and local model state are excluded.

## Local verification

```sh
npm ci
npm run build
npm run test:onboarding
python3 -m unittest discover -s deploy/synapdome-ui/tests
```

Scanner execution additionally needs Docker, Redis, the relevant images/services and authorized test fixtures. Passing the checks above does not validate every scanner or live authentication.
