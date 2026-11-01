// Anti-spam controls: honeypot, minimum form age, per-IP rate limiting and
// duplicate suppression. Rate/duplicate state is in-memory per instance —
// adequate for this site's traffic and the serverless consumption plan; the
// deployment doc covers platform-level hardening (WAF / Front Door) if abuse
// ever appears.

export function isHoneypotTripped(formData) {
  const v = formData.get("website");
  return typeof v === "string" && v.trim() !== "";
}

export function isTooFast(formData, { minFormAgeMs }, now = Date.now()) {
  const raw = formData.get("form_started_at");
  const started = Number.parseInt(raw, 10);
  if (!Number.isFinite(started)) return true;
  return now - started < minFormAgeMs;
}

export function createRateLimiter({ rateLimitPerHour }) {
  const hits = new Map(); // ipHash -> timestamps
  return {
    allow(key, now = Date.now()) {
      const windowStart = now - 3600_000;
      const list = (hits.get(key) || []).filter(t => t > windowStart);
      if (list.length >= rateLimitPerHour) { hits.set(key, list); return false; }
      list.push(now);
      hits.set(key, list);
      return true;
    },
  };
}

// Suppresses accidental double submissions (double-click, browser retry):
// the same email on the same form within the window is acknowledged with
// 200 but neither stored again nor re-notified.
export function createDuplicateGuard({ duplicateWindowMs }) {
  const seen = new Map(); // form|email(lowercased) -> { at, id }
  return {
    check(form, email, id, now = Date.now()) {
      const key = form + "|" + String(email).toLowerCase();
      const prev = seen.get(key);
      if (prev && now - prev.at < duplicateWindowMs) return prev.id;
      seen.set(key, { at: now, id });
      return null;
    },
  };
}
