# API Testing Playbook

Use this playbook when the target includes REST, GraphQL, OpenAPI, Postman collections, captured requests, mobile API calls, or browser network traffic.

## Required Inputs

- API base URL or captured requests.
- Authentication method and test credentials or tokens if needed.
- Allowed methods, domains, and rate limits.
- Any roles or tenants that are in scope.

## Default Flow

1. Parse supplied API definitions or captured requests.
2. Identify endpoints, methods, parameters, headers, and auth context.
3. Ask for approval before replaying authenticated or state-changing requests.
4. Run passive analysis on schemas and captured traffic.
5. Execute bounded checks for authorization, input validation, and sensitive data exposure.
6. Store request/response evidence.

## Checks

- Missing authentication.
- Broken object-level authorization.
- Excessive data exposure.
- Unsafe methods exposed unintentionally.
- Verb tampering.
- Weak CORS.
- Token leakage in URLs, referrers, logs, or responses.
