import test from "node:test";
import assert from "node:assert/strict";
import { makeHandler, makeFormData, makeRequest, body, pdfBytes } from "./helpers.mjs";

test("valid request-talent (EN) is accepted, stored and notified", async () => {
  const { handle, stored, sent } = makeHandler();
  const res = await handle("request-talent", makeRequest(makeFormData("request-talent")), { clientIp: "1.1.1.1" });
  const b = await body(res);
  assert.equal(res.status, 200);
  assert.equal(b.ok, true);
  assert.match(b.id, /^[0-9a-f-]{36}$/);
  assert.equal(stored.length, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "info@outliners.gr");
  assert.equal(sent[0].replyTo, "person@example.com");
});

test("valid submit-cv (EL) is accepted with its file", async () => {
  const { handle, stored } = makeHandler();
  const fd = makeFormData("submit-cv", { fields: { lang: "el" } });
  const res = await handle("submit-cv", makeRequest(fd), { clientIp: "1.1.1.2" });
  assert.equal(res.status, 200);
  assert.equal(stored[0].record.fields.lang, "el");
  assert.equal(stored[0].file.type, "pdf");
});

test("missing required fields are rejected with per-field codes", async () => {
  const { handle, stored } = makeHandler();
  const fd = makeFormData("request-talent", { fields: { full_name: "", company: undefined, job_description: "   " } });
  fd.delete("company");
  const res = await handle("request-talent", makeRequest(fd), {});
  const b = await body(res);
  assert.equal(res.status, 422);
  assert.equal(b.errors.full_name, "required");
  assert.equal(b.errors.company, "required");
  assert.equal(b.errors.job_description, "required");
  assert.equal(stored.length, 0);
});

test("invalid email, enum and linkedin URL are rejected", async () => {
  const { handle } = makeHandler();
  const fd = makeFormData("submit-cv", { fields: { email: "not-an-email", linkedin: "http://insecure.example" } });
  const res = await handle("submit-cv", makeRequest(fd), {});
  const b = await body(res);
  assert.equal(res.status, 422);
  assert.equal(b.errors.email, "format");
  assert.equal(b.errors.linkedin, "format");

  const fd2 = makeFormData("request-talent", { fields: { employment_type: "gig-work" } });
  const b2 = await body(await handle("request-talent", makeRequest(fd2), {}));
  assert.equal(b2.errors.employment_type, "format");
});

test("missing consent is rejected and nothing is stored", async () => {
  const { handle, stored, sent } = makeHandler();
  const fd = makeFormData("request-talent");
  fd.delete("consent");
  const res = await handle("request-talent", makeRequest(fd), {});
  assert.equal(res.status, 422);
  assert.equal((await body(res)).errors.consent, "required");
  assert.equal(stored.length + sent.length, 0);
});

test("CR/LF injection in fields cannot reach the email subject or reply-to", async () => {
  const { handle, sent } = makeHandler();
  const fd = makeFormData("request-talent", {
    fields: { full_name: "Evil\r\nBcc: victim@example.com", email: "person@example.com" },
  });
  const res = await handle("request-talent", makeRequest(fd), {});
  assert.equal(res.status, 200);
  assert.ok(!sent[0].subject.includes("\r") && !sent[0].subject.includes("\n"));
  assert.ok(!sent[0].subject.includes("Bcc:") || !sent[0].subject.includes("\n"));
  assert.ok(!/[\r\n]/.test(sent[0].replyTo));
});

test("GET is refused with 405, non-multipart with 415, malformed multipart with 400", async () => {
  const { handle } = makeHandler();
  const get = await handle("request-talent", new Request("http://x/", { method: "GET" }), {});
  assert.equal(get.status, 405);
  const jsonReq = new Request("http://x/", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal((await handle("request-talent", jsonReq, {})).status, 415);
  const broken = new Request("http://x/", {
    method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" }, body: "not-multipart" });
  assert.equal((await handle("request-talent", broken, {})).status, 400);
});

test("unknown form name is a 404", async () => {
  const { handle } = makeHandler();
  const res = await handle("nope", makeRequest(makeFormData("request-talent")), {});
  assert.equal(res.status, 404);
});
