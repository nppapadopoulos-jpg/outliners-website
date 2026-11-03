import { createFormsHandler } from "../src/core/handler.js";
import { createLogger } from "../src/core/privacy.js";

// ---- fixture files ----
export function pdfBytes(size = 800) {
  const b = Buffer.alloc(size, 0x20);
  b.write("%PDF-1.4\n% OutLiners test fixture\n", 0, "latin1");
  return b;
}
export function docxBytes() {
  const b = Buffer.alloc(1200, 0);
  b.write("PK\x03\x04", 0, "latin1");
  b.write("[Content_Types].xml", 30, "latin1");
  return b;
}
export function docBytes() {
  const b = Buffer.alloc(1024, 0);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(b, 0);
  return b;
}
export function zipNotDocxBytes() {
  const b = Buffer.alloc(1024, 0x41);
  b.write("PK\x03\x04", 0, "latin1");
  return b;
}

// ---- valid field sets (mirror the live forms) ----
export function validFields(form, lang = "en") {
  const common = {
    full_name: "Test Person",
    email: "person@example.com",
    consent: "yes",
    lang,
    form_started_at: String(Date.now() - 10_000),
  };
  if (form === "request-talent") {
    return {
      ...common,
      company: "Example AE",
      job_title: "Senior Engineer",
      location: "Athens",
      employment_type: "full-time",
      timeline: "1-3-months",
      job_description: "A meaningful description of the role.",
    };
  }
  return {
    ...common,
    phone: "+30 690 000 0000",
    specialization: "Software engineering",
    talent_pool_consent: "yes",
    preferred_location: lang === "el" ? "Αθήνα" : "Athens",
  };
}

export function makeFormData(form, { fields = {}, file, fileField } = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...validFields(form), ...fields })) {
    if (v !== undefined && v !== null) fd.set(k, v);
  }
  const defaultField = form === "submit-cv" ? "cv" : "attachment";
  if (form === "submit-cv" && file === undefined) {
    file = { name: "cv.pdf", bytes: pdfBytes() };
  }
  if (file) {
    fd.set(fileField ?? defaultField, new File([file.bytes], file.name, { type: file.mime ?? "application/octet-stream" }));
  }
  return fd;
}

export function makeRequest(formData) {
  return new Request("http://localhost/api/x", { method: "POST", body: formData });
}

// ---- mock ports ----
export function mockPorts({ storageFails = false, emailFails = false } = {}) {
  const stored = [];
  const sent = [];
  const logs = [];
  return {
    stored, sent, logs,
    storage: {
      async store(args) {
        if (storageFails) { const e = new Error("boom"); e.code = "mock-storage"; throw e; }
        stored.push(args);
        return `${args.form}/2026-11/${args.id}`;
      },
    },
    email: {
      async send(msg) {
        if (emailFails) { const e = new Error("boom"); e.code = "mock-email"; throw e; }
        sent.push(msg);
        return { delivered: false };
      },
    },
    logger: createLogger(line => logs.push(line)),
  };
}

export function testConfig(overrides = {}) {
  return {
    notifyEmail: "info@outliners.gr",
    senderEmail: "no-reply@outliners.gr",
    maxFileBytes: 5 * 1024 * 1024,
    maxRequestBytes: 7 * 1024 * 1024,
    minFormAgeMs: 3000,
    rateLimitPerHour: 5,
    duplicateWindowMs: 10 * 60 * 1000,
    ipHashSalt: "test-salt",
    retentionDays: null,
    ...overrides,
  };
}

export function makeHandler(opts = {}) {
  const ports = mockPorts(opts);
  const handle = createFormsHandler({ config: testConfig(opts.config), ...ports });
  return { handle, ...ports };
}

export async function body(res) {
  return JSON.parse(await res.text());
}
