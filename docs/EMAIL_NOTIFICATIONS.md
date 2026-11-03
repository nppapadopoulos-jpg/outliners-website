# Durable private email notifications

## Resources and authorization

The Owner approved ACS Email with an Azure-managed sender, up to an estimated
additional USD 1/month, on 2026-11-03. The existing OUTLINERS resource group is
reused. No custom-domain verification or public DNS change is needed.

- Email service: `ecs-outliners-email-8dc62205`, global / Europe data location.
- Domain: `AzureManagedDomain`; SPF, DKIM, DKIM2, DMARC and Domain verified by Azure;
  engagement tracking disabled.
- Communication service: `acs-outliners-email-8dc62205`, global / Europe.
- Sender: the provisioned `donotreply@…azurecomm.net` address, configured in Azure.
- Recipient: hardcoded `info@outliners.gr` in the Azure transport.
- Authentication: the existing user-assigned Managed Identity. No connection
  string, access key, SMTP password or client secret is used.
- Custom runtime role: only `Microsoft.Communication/CommunicationServices/Read`
  and `/Write`, the documented ACS REST Entra authentication permissions.
  Assignment is restricted to this Communication Services resource. This is
  narrower than Contributor / Communication and Email Service Owner; it is not
  a dedicated email-send DataAction. No IAM, key-listing or deletion permission.

## Durable dispatch

The closed Azure forms retain their existing storage contract. Once intake is
separately approved, committing `submission.json` is also the durable discovery
marker for an email. No request-time ACS send occurs. This avoids a gap between
successful submission storage and enqueueing after a process crash.

The ten-minute timer lists existing submission blob names with metadata. It
creates missing `notification.json` sidecars only for committed, unexpired,
path/ID/form-consistent records. The sidecar contains only operational state:
reference, form, deadline, status, attempts, operation ID and timestamps. It does
not duplicate candidate fields or file names. Twelve-month deletion removes
this sidecar together with its submission, metadata last.

`notifications/control.json` stores the UTC monthly send counter and global next
request time. A 60-second Blob lease serializes workers; it is renewed before
writes and external calls. Conditional ETags reject stale sidecar writes. The
same existing container-level storage role and private Blob endpoint are reused.

Before POST, both the budget reservation and operation identity are persisted.
Accepted/running operations are polled by the same operation ID after restart.
The transport uses the persisted repeatability request ID and first-sent header.
ACS only tracks repeatability for five minutes. An ambiguous timeout/5xx/409/412
therefore never starts a fresh send: it polls the existing operation; if absent,
it enters `uncertain` for manual reconciliation. This intentionally prioritizes
avoiding duplicate email over blind retries. There is no exactly-once mailbox
delivery claim.

An explicit 429 rejection is retried with exponential backoff, respecting the
larger Retry-After delay, up to six attempts. Definitive 400/401/403/413/422 and
terminal provider failures stop for review. Polling is bounded at 144 attempts.
A new process uses only persisted state; instance memory is not the queue.

## Limits and privacy

- One send or status request per ten minutes globally: at most six/hour, below
  Azure-managed-domain limits of five sends/minute and ten/hour.
- At most 500 reserved POST attempts per UTC month, including retries; failing
  reservation/state writes stop dispatch before the external call.
- Notifications contain only the submission reference and form type, plus an
  instruction to open the Owner console. No attachments, candidate details,
  candidate Reply-To, storage paths, public links, SAS or tracking pixels.
- Tokens, raw SDK errors, provider response bodies and candidate data are not
  logged. Logs expose a fixed cycle outcome only.
- `Succeeded` is ACS operation completion, not independent mailbox receipt.

## Incremental cost model

Azure Retail Prices API was queried on 2026-11-03: Email is USD 0.00025 per
recipient email plus USD 0.00012 per MB transferred. Azure-managed domain
provisioning has no charge. Both parent resources have usage-based email costs;
no fixed monthly email plan, Event Grid, Log Analytics, queue service, extra
storage account or Private Endpoint was introduced.

| Scenario | Assumptions | Estimated incremental monthly cost before tax |
| --- | --- | --- |
| Idle/minimum | No email, ten-minute timer and small existing Blob index | USD 0.01–0.05 |
| Expected | Up to 100 notifications, small plain text, <=1,200 retained records, existing Flex free grant available | USD 0.05–0.20 |
| Adverse bounded workload | 500 reserved POST attempts including retries, no attachments, <=6 total ACS calls/hour, conservative extra storage/runtime usage | USD 0.20–0.75 |

At 100 emails with 10 KB transferred each, email charges are approximately
USD 0.02512; at 500 they are USD 0.1256. The remainder of the estimates allows
for Blob list/read/write/lease operations and short Flex invocations. Functions
free grants are subscription-wide, not guaranteed per app. Cost is a usage
estimate, not an Azure hard spending cap; the existing budget is only an alert.
If workload, retained index size, pricing or required resources exceed these
assumptions, pause dispatch and obtain approval before expansion.

Public forms remain disabled. There is no GitHub merge authorization.

## Verification

Functional code: `c2dd25945a3ca97be41316c01279940bc940084e`.
CI #146 (run `41717179123`) passed 69 backend tests, packaging, smoke and UI.
The local smoke suite checked 25 pages. Tests include persistent Blob sidecar
reconstruction, ETag conflict, concurrent exclusion, explicit 429/backoff,
ambiguous POST response, restart polling, budget limits and privacy.

## Actual Azure exercise and blocking delivery result

Two fixed synthetic submission records (one CV notification and one hiring
request) were created through the existing maintenance timer, not the closed
public forms. A synthetic 429 with Retry-After was injected in the first cycle;
its pending state and backoff were read back from real private Blob Storage.
The clock was advanced for the test; this was not a real ACS outage or an hour
of elapsed time.

After an actual Function App restart, both notifications were accepted by the
real ACS endpoint with HTTP 202 using Managed Identity. After another restart,
the saved operation IDs were polled: both returned HTTP 200 / Succeeded. The
host instance ID changed between phases. Re-running the worker returned idle
and left the durable monthly reservation count at three (one injected rejection,
two real POSTs), confirming no further sends. The synthetic report was retrieved
only through the authenticated Owner/MFA download API.

**Actual recipient delivery FAILED.** Standard Azure Monitor metric
`DeliveryStatusUpdate` on the otherwise unused ACS resource recorded exactly
two `Bounced` events, `SmtpStatusCode=550`, `EnhancedSmtpStatusCode=5.1.1`,
`IsHardBounce=True`. There were only two actual sends, both exclusively to
`info@outliners.gr`. Thus ACS operation success must not be reported as mailbox
delivery success. No Event Grid, paid diagnostic sink or extra monitoring
resource was created to obtain this evidence.

The recipient mailbox/address must be validated by its mail administrator before
another test. Check that `info@outliners.gr` exists, is enabled, and accepts
external mail; correct the mailbox or alias within its current mail provider.
Do not change public DNS, change recipient, or buy a mail service automatically.
`ENABLE_EMAIL_NOTIFICATIONS=false` is the final safe state pending that fix.
The two synthetic records and their test report are removed; temporary
maintenance code/settings are removed from the final clean deployment.
The aggregate monthly counter remains conservative; it was not reset to bypass
limits. Existing seven-day Blob soft-delete recovery still applies.

## Operational recovery

Disable `ENABLE_EMAIL_NOTIFICATIONS` to pause all dispatch without affecting CV
storage or the closed intake gates. Never delete/reset an uncertain operation
and blindly retry. Investigate the saved operation ID in ACS and reconcile
recipient evidence before any deliberate resend. Definitively rejected sends
can be reviewed, corrected and re-queued only under the global lease, retaining
the audit context and monthly counter. Do not reset the counter to bypass cost
controls. A saved `succeeded` state remains terminal across redeployment.

## Primary references

- https://learn.microsoft.com/azure/communication-services/quickstarts/email/add-azure-managed-domains
- https://learn.microsoft.com/azure/communication-services/concepts/email-pricing
- https://learn.microsoft.com/azure/communication-services/concepts/service-limits
- https://learn.microsoft.com/rest/api/communication/repeatable-requests
- https://learn.microsoft.com/samples/azure-samples/communication-services-dotnet-quickstarts/email-sample-send-email-with-managed-identity/
