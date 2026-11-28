# UI startup payloads

The browser requests compact responses using `x-synapdome-ui-summary: 1`.

- `/agent` retains agent metadata but omits prompts and returns an empty permission
  list in the UI representation. Execution and permission enforcement continue to
  use the complete server-side agent configuration; the summary is never used to
  authorize tools.
- `/provider` retains every provider's connection metadata and the complete model
  catalogs of connected providers. Disconnected providers have empty model lists;
  connecting them triggers the existing refresh and supplies their models.
- Calls without the header retain the original full API responses. Responses vary
  on the header; the development CORS allowlist includes it.

This avoids sending large repeated permission arrays and unused model catalogs
when initializing each workspace. There is no shared cross-directory cache and
no stale configuration window. The Android panel and services are unaffected.

`prepare.sh` applies `ui-loading.patch` after the branding and storage patches.
Regression tests verify that summaries do not mutate the full agent configuration
and retain complete connected models. Deployment verification compares both API
representations. Payload timings measured on server loopback do not represent
end-to-end browser rendering or the user's internet connection.

## Linux verification, 28 November 2026

| Response | Full API | Compact UI |
| --- | ---: | ---: |
| Agents | 37,798,184 bytes | 8,636 bytes |
| Providers | 8,436,754 bytes | 50,597 bytes |

Combined payload reduction: approximately 99.87%. Full and compact agent
metadata matched, connected-provider models matched, and all provider connection
cards remained available. The Linux build, typecheck and 29 targeted tests passed.
Android/mobile-runtime process IDs remained unchanged through the UI restart.
