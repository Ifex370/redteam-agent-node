# Web DAST Playbook

Use this playbook when the target is a web application, marketing site, portal, dashboard, or public/private web surface.

## Objectives

- Confirm the authorized target and allowed domain scope.
- Discover reachable application surfaces.
- Identify forms, authentication boundaries, interesting links, APIs, and exposed metadata.
- Run passive and active checks that are allowed by policy.
- Correlate tool output with browser-observed evidence.

## Default Flow

1. Validate the target URL and allowed domains.
2. Start with passive discovery: page load, headers, cookies, links, forms, scripts, and network requests.
3. Run low-risk scanning with Nuclei or ZAP baseline.
4. If useful and approved, run directory enumeration.
5. If authentication is required, ask the user for test credentials or a captured authenticated request.
6. Generate browser scripts only inside the per-engagement workspace.
7. Save evidence: screenshots, requests, responses, generated scripts, scanner output, and notes.
8. Summarize findings and suggest follow-up actions.

## Follow-Up Decisions

Suggest another action when:

- A login form is found but credentials are missing.
- A payment, checkout, upload, or admin flow is discovered.
- A scanner result needs validation in the browser.
- The target blocks automated requests.
- The tool output is empty but the browser shows meaningful application behavior.

## Default Tools

- `nuclei` for template-based web checks.
- `zap` for baseline passive analysis.
- `directory-enumeration` for content discovery when approved.
- Playwright browser control for observation and workflow validation.
