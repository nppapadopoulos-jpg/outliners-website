import { createHash, randomUUID } from "node:crypto";

// One-way, salted IP digest. Used for rate limiting and audit logs so that
// no raw IP address is ever stored or logged.
export function ipHash(ip, salt) {
  return createHash("sha256").update(salt + "|" + (ip || "unknown")).digest("hex").slice(0, 16);
}

export function newSubmissionId() {
  return randomUUID();
}

// Structured audit logger that cannot leak personal data: it accepts only a
// fixed set of metadata keys. Anything else is dropped, by design.
const ALLOWED_KEYS = new Set([
  "event", "form", "id", "lang", "ipHash", "outcome", "code",
  "fileType", "fileBytes", "durationMs", "duplicateOf", "reason",
]);

export function createLogger(sink = line => console.log(line)) {
  return {
    log(level, data) {
      const safe = { ts: new Date().toISOString(), level };
      for (const [k, v] of Object.entries(data)) {
        if (ALLOWED_KEYS.has(k)) safe[k] = v;
      }
      sink(JSON.stringify(safe));
    },
    info(data) { this.log("info", data); },
    warn(data) { this.log("warn", data); },
    error(data) { this.log("error", data); },
  };
}

// Retention: computes the auto-delete date for a record, or null while the
// owner/legal retention decision is pending (flagged, never silently kept).
export function deleteAfter(retentionDays, now = Date.now()) {
  if (retentionDays === null || retentionDays === undefined) return null;
  return new Date(now + retentionDays * 86400_000).toISOString();
}

// Exact UTC calendar-month retention; clamps end-of-month dates.
export function deleteAfterMonths(months, now = Date.now()) {
  if (months == null) return null;
  if (!Number.isInteger(months) || months < 1) throw new RangeError("Invalid retention months");
  const start = new Date(now);
  if (Number.isNaN(start.getTime())) throw new RangeError("Invalid timestamp");
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + months;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(start.getUTCDate(), last), start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), start.getUTCMilliseconds())).toISOString();
}
