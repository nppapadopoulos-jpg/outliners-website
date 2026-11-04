# Azure Functions backend — staging deployed, public intake disabled

See [current status and deployment gates](../../docs/AZURE_BACKEND_STATUS.md).
Deploy the complete staged `api` package, including shared source and the root
package lock. This directory alone is not a deployable unit.

This directory is the deployment unit for the preferred hosting option
(Azure Static Web Apps with a linked Functions backend). It wires the same
hosting-independent core from `api/src/core/` to Azure adapters.

**Honest status:** everything in `api/src/core/` and the local adapters is
fully unit/integration tested in this repository. The files in this folder
and in `api/src/adapters/azure/` are *reference implementations*: they follow
the current SDK APIs but **cannot be executed or verified here**, because no
Azure resources or credentials exist (deliberately — see PR restrictions).
They must be validated in a staging environment before go-live.

Layout:

- `host.json`, `package.json` — Functions host configuration and dependencies
  (`@azure/functions`, `@azure/storage-blob`, `@azure/communication-email`).
- `src/functions/forms.js` — registers POST `/api/request-talent` and
  `/api/submit-cv`, passing the Functions `HttpRequest` (fetch-compatible)
  straight into the shared core handler.

Required app settings (no secrets in the repo):

| Setting | Purpose |
|---|---|
| `STORAGE_ACCOUNT_URL` | `https://<account>.blob.core.windows.net` (EU region) |
| `STORAGE_CONTAINER` | private container name, e.g. `submissions` |
| `ACS_CONNECTION_STRING` or managed identity + `ACS_ENDPOINT` | email delivery |
| `NOTIFY_EMAIL`, `SENDER_EMAIL` | recipients/sender |
| `IP_HASH_SALT` | long random value |
| `RETENTION_DAYS` | owner/legal decision |
| `MIN_FORM_AGE_MS`, `RATE_LIMIT_PER_HOUR`, … | optional overrides |

Identity: prefer a system-assigned managed identity with the
`Storage Blob Data Contributor` role on the container instead of connection
strings. The container must have **no anonymous access**.
