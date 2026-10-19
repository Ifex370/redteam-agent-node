# SynapDome onboarding deployment handover

## Approved customer flow

Customer fills details and scope → reviews the generated PDF → selects
**Submit for review** → enterprise@synapdome.com receives the PDF → customer
receives an acknowledgement from enterprise@synapdome.com.

Operations adds the fee and hourly remediation rate, confirms scope and terms,
then emails the finalized PDF to the customer for signature using the normal
business mailbox. Countersign and return a completed copy. DocuSign is not
required. No payment, signature, booking or scan is initiated by this form.

The agreement uses the supplied DedSec Africa letterhead. The fee is blank.
Preliminary remediation guidance is due within 48 hours of confirmed kickoff;
the final report is due within seven calendar days. No payment before kickoff.
Payment unlocks the full finalized report and findings. Walkthroughs are billed
separately per hour. There is no refund promise. Payment gating is an agreed
commercial term, not an implemented payment portal.

## Resend setup

1. Create a Resend account. Add `synapdome.com` as a sending domain, so the
   sender can be exactly `enterprise@synapdome.com`.
2. Add the exact DNS verification records displayed by Resend and wait until
   verified. Preserve existing mailbox MX records. Sending verification does
   not create the business mailbox: ensure enterprise@synapdome.com actually
   receives mail and can be used by operations to reply manually.
3. Create a sending API key restricted to this domain where available. Save
   it only in the deployment secret store or a private root `.env` file.
4. Copy `Synap AT/onboarding.env.example` into the deployment environment.
   Set SMTP_PASSWORD to that API key. SMTP username is `resend`, host is
   `smtp.resend.com`, and port 465 uses TLS. Port 587 with STARTTLS also works.
5. Confirm SMTP_FROM is `enterprise@synapdome.com`. The staff recipient is
   fixed server side to that same address. Staff notifications use the
   customer's address as Reply-To; customer acknowledgements reply to staff.
6. Complete one real test submission using a mailbox you control. Confirm
   both emails arrive, the PDF opens, and the acknowledgement sender is correct.
   Inspect the Resend Emails dashboard for delivery or bounce status.

Official references:
https://resend.com/docs/send-with-smtp
https://resend.com/docs/dashboard/domains/introduction

## Deploy the Node service

Use Node.js 24 LTS from the repository root:

```sh
npm ci
npm run build
npm run test:onboarding
npm run start:onboarding
```

Run under your existing process manager with restart on failure, working
directory set to the repository root, and the private environment loaded.
Create ONBOARDING_DATA_DIR with service-account-only access on persistent
storage outside the public web root. Run one process with this file store.
Back up the private directory and define a retention period.

Reverse proxy HTTPS at `at.synapdome.com` to the configured loopback port
(default 4174). Forward `/api/onboarding/*`, `/pdfjs/*`, and the static routes.
Set PUBLIC_ORIGIN to exactly `https://at.synapdome.com`, without a trailing
slash. ONBOARDING_LOCAL_PREVIEW must be `false` for actual email sending.

This service serves `/onboarding.html`, the PDF viewer assets and marketing
site. The old Python server and old Dockerfile do not serve these APIs.
Do not expose the separate internal assessment worker API. Keep newer live
marketing changes if the deployed page differs from this repository and add
an `/onboarding.html` link. No DocuSign environment variables are needed.
Legacy DocuSign endpoints remain in the code for compatibility but the form
uses the manual email review flow.

## Draft documents and manual completion

`Synap AT/templates/dedsec-letterhead.pdf` supplies the letterhead.
`Synap AT/templates/demo-terms.json` supplies draft defaults. These still
include illustrative retention, liability, governing law and provider
acceptance wording. Review and replace those terms in the finalized PDF
before sending it for signature. The emailed draft is explicitly unsigned
and marked for internal review. Do not treat it as a finalized contract.

The PDFs are ordinary PDFs, not interactive form fields. Operations needs a
PDF editor to update pricing and finalize text. Never edit a signed PDF;
issue a replacement agreement if scope changes. Staff then stores the signed
copy using the existing private engagement record process.

## Failure handling and launch checks

Submissions and draft PDFs are persisted privately before sending. Status
`awaiting_review` means SMTP accepted the staff email, not inbox delivery.
`acknowledged: false` means the staff email was accepted but customer
acknowledgement failed. `delivery_uncertain` requires operator investigation
in Resend before retrying. No automatic retry queue exists. A process crash
can leave a record in `sending`; investigate it similarly. Resend headers
provide separate idempotency keys per reference for staff and customer mail.

Add edge bot protection and rate limits before launch. The built-in rate
limit is five POST requests per peer IP per hour; preview and submission
both count. Behind a reverse proxy all clients may share that bucket. Adapt
trusted proxy handling to the actual hosting topology before public traffic;
never blindly trust arbitrary forwarded IP headers. For multiple replicas,
replace file storage and in-memory limits with shared durable services.

Verify invalid input is rejected, missing SMTP returns an honest error,
customer data is absent from public status responses, and the private data
folder is not web accessible. Review logs and Resend bounces for failures.
No real Resend send was performed during implementation because credentials
and verified sending domain were not supplied. Automated checks use mocks.

## Local demonstration

```sh
ONBOARDING_LOCAL_PREVIEW=true ONBOARDING_PORT=4176 PUBLIC_ORIGIN=http://127.0.0.1:4176 npm run start:onboarding
```

Open http://127.0.0.1:4176/onboarding.html. Generate a PDF and select Submit
for review. This simulates the outcome and never sends mail, even if SMTP
credentials are present. It requires a loopback host and origin.
