# Login Flow Testing Playbook

Use this playbook when the target includes login, registration, reset password, MFA, SSO, or session management flows.

## Required Inputs

- Authorized target URL.
- Confirmation that authentication testing is in scope.
- Test credentials, a test account, or permission to proceed without credentials.
- Any known role boundaries such as user, admin, merchant, or support.

## Default Flow

1. Identify login and account-related pages.
2. Capture visible fields, hidden fields, CSRF tokens, cookies, redirects, and network requests.
3. Ask for approval before submitting credentials, testing lockout behavior, or replaying login requests.
4. Validate session cookie attributes and security headers.
5. Test only low-rate, bounded authentication behavior unless the user explicitly approves more.
6. Capture screenshots and request/response evidence.

## Checks

- Missing `HttpOnly`, `Secure`, or `SameSite` cookie attributes.
- Login over HTTP.
- Open redirects in login or return URLs.
- Weak error handling that reveals account existence.
- Broken session invalidation after logout.
- Authorization boundary clues in redirects or API calls.

## Approval Required

- Credential submission.
- Password reset request.
- MFA interaction.
- Repeated login attempts.
- Role-based authorization testing.
- Any test that changes account state.
