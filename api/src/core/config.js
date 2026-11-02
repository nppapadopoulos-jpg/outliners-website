// Environment-based configuration. No secrets are committed; every value
// here is either a safe default or read from the environment at runtime.
// See docs/BACKEND_DEPLOYMENT.md for the full variable reference.

export function loadConfig(env = process.env) {
  return {
    // Recipient of submission notifications. The mailbox must be confirmed
    // by the owner before go-live (see deployment doc).
    notifyEmail: env.NOTIFY_EMAIL || "info@outliners.gr",
    // Sender identity for notifications (provider-verified address).
    senderEmail: env.SENDER_EMAIL || "no-reply@outliners.gr",

    maxFileBytes: int(env.MAX_FILE_BYTES, 5 * 1024 * 1024),
    maxRequestBytes: int(env.MAX_REQUEST_BYTES, 7 * 1024 * 1024),

    // Spam controls
    minFormAgeMs: int(env.MIN_FORM_AGE_MS, 3000),
    rateLimitPerHour: int(env.RATE_LIMIT_PER_HOUR, 5),
    duplicateWindowMs: int(env.DUPLICATE_WINDOW_MS, 10 * 60 * 1000),

    // Privacy: salt for one-way IP hashing in logs/rate limiting.
    // MUST be set to a long random value in production (fails closed there).
    ipHashSalt: env.IP_HASH_SALT || "dev-only-salt",

    // GDPR retention in days. Intentionally unset by default: the retention
    // period is an OWNER/LEGAL DECISION. While unset, records are stored
    // without a deleteAfter date and the purge tool refuses to run.
    retentionDays: env.RETENTION_DAYS ? int(env.RETENTION_DAYS, 0) : null,
    retentionMonths: env.RETENTION_MONTHS ? int(env.RETENTION_MONTHS, 0) : null,

    // Local adapter settings
    storageDir: env.STORAGE_DIR || new URL("../../.data/submissions/", import.meta.url).pathname,
    emailSinkDir: env.EMAIL_SINK_DIR || new URL("../../.data/outbox/", import.meta.url).pathname,

    production: env.NODE_ENV === "production",
  };
}

export function assertProductionConfig(cfg) {
  const problems = [];
  if (cfg.ipHashSalt === "dev-only-salt") problems.push("IP_HASH_SALT must be set");
  if (cfg.retentionDays === null && cfg.retentionMonths === null) problems.push("RETENTION_MONTHS or RETENTION_DAYS must be set");
  if (cfg.retentionMonths !== null && (!Number.isInteger(cfg.retentionMonths) || cfg.retentionMonths < 1)) problems.push("RETENTION_MONTHS must be positive");
  if (problems.length) throw new Error("Unsafe production configuration: " + problems.join("; "));
}

function int(v, fallback) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
