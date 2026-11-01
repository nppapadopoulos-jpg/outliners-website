// Hosting-independent request handler: Web-standard Request in, Response out.
// Azure Functions v4, the bundled local Node server, or any other runtime
// that speaks fetch primitives can host it unchanged. All side effects go
// through injected ports (storage, email, logger) so the core is fully
// testable without cloud credentials.

import { FORMS } from "./schema.js";
import { validateFields, sanitizeFilename } from "./validate.js";
import { checkFile } from "./files.js";
import { isHoneypotTripped, isTooFast, createRateLimiter, createDuplicateGuard } from "./spam.js";
import { ipHash, newSubmissionId, createLogger, deleteAfter } from "./privacy.js";
import { buildNotification } from "./notify.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function createFormsHandler({ config, storage, email, logger = createLogger() }) {
  const rateLimiter = createRateLimiter(config);
  const duplicates = createDuplicateGuard(config);

  /**
   * @param {string} formName  "request-talent" | "submit-cv"
   * @param {Request} request
   * @param {{ clientIp?: string }} ctx
   */
  return async function handle(formName, request, ctx = {}) {
    const started = Date.now();
    const spec = FORMS[formName];
    if (!spec) return json(404, { ok: false });
    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: { ...JSON_HEADERS, allow: "POST" } });
    }

    const hashedIp = ipHash(ctx.clientIp, config.ipHashSalt);
    const base = { form: formName, ipHash: hashedIp };

    // Early size guard before buffering anything.
    const declared = Number.parseInt(request.headers.get("content-length") ?? "", 10);
    if (Number.isFinite(declared) && declared > config.maxRequestBytes) {
      logger.warn({ ...base, event: "rejected", code: "too-large" });
      return json(413, { ok: false, errors: { file: "too-large" } });
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return json(415, { ok: false, errors: { request: "unsupported-media-type" } });
    }

    if (!rateLimiter.allow(hashedIp)) {
      logger.warn({ ...base, event: "rate-limited" });
      return json(429, { ok: false, retry: true });
    }

    let formData;
    try {
      formData = await request.formData();
    } catch {
      logger.warn({ ...base, event: "rejected", code: "malformed-multipart" });
      return json(400, { ok: false, errors: { request: "malformed" } });
    }

    // Honeypot: accept silently, store nothing, notify nobody.
    if (isHoneypotTripped(formData)) {
      logger.info({ ...base, event: "honeypot-discarded", outcome: "discarded" });
      return json(200, { ok: true });
    }
    if (isTooFast(formData, config)) {
      logger.info({ ...base, event: "rejected", code: "too-fast" });
      return json(422, { ok: false, errors: { form_started_at: "too-fast" } });
    }

    const { fields, errors } = validateFields(formName, formData);

    // File handling (required for submit-cv, optional for request-talent).
    let file = null;
    const fileEntry = formData.get(spec.file.name);
    const hasFile = fileEntry && typeof fileEntry === "object" && typeof fileEntry.arrayBuffer === "function" && fileEntry.size > 0;
    if (!hasFile && spec.file.required) {
      errors[spec.file.name] = "required";
    } else if (hasFile) {
      const checked = await checkFile(fileEntry, config);
      if (!checked.ok) {
        if (checked.code === "too-large") {
          logger.info({ ...base, event: "rejected", code: "too-large" });
          return json(413, { ok: false, errors: { [spec.file.name]: "too-large" } });
        }
        errors[spec.file.name] = checked.code;
      } else {
        file = {
          storedName: sanitizeFilename(fileEntry.name),
          type: checked.type,
          bytes: checked.bytes.length,
          content: checked.bytes,
        };
      }
    }

    if (Object.keys(errors).length > 0) {
      logger.info({ ...base, event: "rejected", code: "validation", reason: Object.keys(errors).sort().join(",") });
      return json(422, { ok: false, errors });
    }

    const id = newSubmissionId();

    // Duplicate suppression: acknowledge without re-storing or re-notifying.
    const dupOf = duplicates.check(formName, fields.email, id);
    if (dupOf) {
      logger.info({ ...base, event: "duplicate-suppressed", id, duplicateOf: dupOf, outcome: "duplicate" });
      return json(200, { ok: true, id: dupOf, duplicate: true });
    }

    const record = {
      id,
      form: formName,
      receivedAt: new Date().toISOString(),
      deleteAfter: deleteAfter(config.retentionDays),
      consent: { value: "yes", recordedAt: new Date().toISOString() },
      fields: Object.fromEntries(Object.entries(fields).filter(([k]) => k !== "consent")),
      file: file ? { name: file.storedName, type: file.type, bytes: file.bytes } : null,
    };

    let storagePath;
    try {
      storagePath = await storage.store({ id, form: formName, record, file });
    } catch (err) {
      logger.error({ ...base, event: "storage-failed", id, reason: err?.code || "error" });
      return json(502, { ok: false, retry: true });
    }

    // Notification failure never loses the submission: the record is already
    // in private storage; the failure is logged for manual follow-up.
    let notified = true;
    try {
      await email.send(buildNotification({ form: formName, id, fields, file, storagePath, config }));
    } catch (err) {
      notified = false;
      logger.error({ ...base, event: "notify-failed", id, reason: err?.code || "error" });
    }

    logger.info({
      ...base, event: "accepted", id, lang: fields.lang, outcome: notified ? "stored+notified" : "stored",
      fileType: file?.type, fileBytes: file?.bytes, durationMs: Date.now() - started,
    });
    return json(200, { ok: true, id });
  };
}
