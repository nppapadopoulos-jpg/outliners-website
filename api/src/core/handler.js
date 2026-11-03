// Hosting-independent request handler: Web-standard Request in, Response out.
// Azure Functions v4, the bundled local Node server, or any other runtime
// that speaks fetch primitives can host it unchanged. All side effects go
// through injected ports (storage, email, logger) so the core is fully
// testable without cloud credentials.

import { FORMS } from "./schema.js";
import { validateFields, sanitizeFilename } from "./validate.js";
import { checkFile } from "./files.js";
import { isHoneypotTripped, isTooFast, createRateLimiter, createDuplicateGuard } from "./spam.js";
import { ipHash, newSubmissionId, createLogger, deleteAfter, deleteAfterMonths } from "./privacy.js";
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
      if (request.body?.getReader) {
        const reader=request.body.getReader(),chunks=[];let count=0;
        while(true){const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>config.maxRequestBytes){await reader.cancel();return json(413,{ok:false,errors:{file:'too-large'}});}chunks.push(value);}
        const bytes=Buffer.concat(chunks.map(v=>Buffer.from(v)));
        formData=await new Request('https://intake.internal/',{method:'POST',headers:{'content-type':contentType},body:bytes}).formData();
      } else formData = await request.formData();
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

    const receivedAt = Date.now();
    const pool = formName === "submit-cv" && fields.talent_pool_consent === "yes";
    const maxDeadline = config.retentionMonths != null ? deleteAfterMonths(config.retentionMonths, receivedAt) : deleteAfter(config.retentionDays, receivedAt);
    const specificDeadline = formName === "submit-cv" && !pool ? deleteAfterMonths(3, receivedAt) : null;
    const deadline = maxDeadline && specificDeadline ? (maxDeadline < specificDeadline ? maxDeadline : specificDeadline) : maxDeadline;
    const record = {
      id,
      form: formName,
      receivedAt: new Date(receivedAt).toISOString(),
      deleteAfter: deadline,
      // Legacy field name retained for compatibility; this event is notice acknowledgement, not blanket consent.
      consent: { value: "yes", purpose: "privacy-notice-acknowledgement", noticeVersion: "2026-11-04", recordedAt: new Date(receivedAt).toISOString() },
      processing: { specificOpportunity: !!fields.position_reference, futureOpportunities: pool, specificBasis: formName === "submit-cv" && fields.position_reference ? "6(1)(f)" : null, futureBasis: pool ? "6(1)(a)" : null },
      talentPoolConsent: formName === "submit-cv" ? { value: pool ? "yes" : "no", noticeVersion: "2026-11-04", recordedAt: new Date(receivedAt).toISOString() } : null,
      fields: Object.fromEntries(Object.entries(fields).filter(([k]) => k !== "consent")),
      file: file ? { name: file.storedName, type: file.type, bytes: file.bytes } : null,
    };

    let storagePath;
    let acceptedId=id;
    try {
      const stored = await storage.store({ id, form: formName, record, file, admission: { ipHash: hashedIp } });
      storagePath = typeof stored==='string' ? stored : stored.path;
      acceptedId = typeof stored==='object' ? stored.id : id;
      if (stored?.duplicate) return json(200,{ok:true,id:acceptedId,duplicate:true});
    } catch (err) {
      duplicates.forget(formName, fields.email, id);
      logger.error({ ...base, event: "storage-failed", id, reason: err?.code || "error" });
      return json(err?.statusCode===429 ? 429 : 502, { ok: false, retry: true });
    }

    // Notification failure never loses the submission: the record is already
    // in private storage; the failure is logged for manual follow-up.
    let notified = true;
    try {
      const result = await email.send(buildNotification({ form: formName, id: acceptedId, fields, file, storagePath, config }));
      notified = result?.delivered !== false;
    } catch (err) {
      notified = false;
      logger.error({ ...base, event: "notify-failed", id, reason: err?.code || "error" });
    }

    logger.info({
      ...base, event: "accepted", id, lang: fields.lang, outcome: notified ? "stored+notified" : "stored",
      fileType: file?.type, fileBytes: file?.bytes, durationMs: Date.now() - started,
    });
    return json(200, { ok: true, id: acceptedId });
  };
}
