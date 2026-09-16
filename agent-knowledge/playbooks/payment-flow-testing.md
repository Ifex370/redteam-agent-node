# Payment Flow Testing Playbook

Use this playbook when the user asks to test checkout, payment, billing, subscription, wallet, invoice, transfer, or funds movement workflows.

## Required Inputs

- Authorized target URL and allowed domains.
- Confirmation that payment or business-logic testing is in scope.
- Test account credentials if authentication is required.
- Confirmation that test cards, sandbox payment data, or non-production funds are being used.

## Default Flow

1. Discover payment entry points and checkout-related pages.
2. Identify cart, pricing, coupon, tax, shipping, invoice, and callback endpoints.
3. Ask for approval before submitting forms or altering transaction state.
4. Generate a browser script to replay only approved happy-path steps.
5. Capture network evidence for each step.
6. Correlate browser evidence with scanner output.

## Checks

- Price manipulation in client-side requests.
- Coupon or discount tampering.
- Missing authorization on order, invoice, or transaction endpoints.
- Insecure callbacks or webhook endpoints.
- Sensitive data exposure in page source or network traffic.
- Weak session/cookie handling around checkout.

## Hard Safety Rule

Do not attempt real payments, fund transfers, destructive order changes, or high-volume testing without explicit written authorization in the engagement context.
