import test from "node:test";
import assert from "node:assert/strict";
import { makeHandler, makeFormData, makeRequest, body } from "./helpers.mjs";

test("honeypot submissions are silently accepted and fully discarded", async () => {
  const { handle, stored, sent, logs } = makeHandler();
  const fd = makeFormData("request-talent", { fields: { website: "https://spam.example" } });
  const res = await handle("request-talent", makeRequest(fd), { clientIp: "9.9.9.9" });
  const b = await body(res);
  assert.equal(res.status, 200);
  assert.equal(b.ok, true);
  assert.equal(b.id, undefined);
  assert.equal(stored.length, 0);
  assert.equal(sent.length, 0);
  assert.ok(logs.some(l => l.includes("honeypot-discarded")));
});

test("submissions faster than the minimum form age are rejected", async () => {
  const { handle } = makeHandler();
  const fd = makeFormData("request-talent", { fields: { form_started_at: String(Date.now() - 500) } });
  const res = await handle("request-talent", makeRequest(fd), {});
  assert.equal(res.status, 422);
  assert.equal((await body(res)).errors.form_started_at, "too-fast");
});

test("missing or non-numeric form_started_at is rejected", async () => {
  const { handle } = makeHandler();
  for (const v of [undefined, "", "yesterday"]) {
    const fd = makeFormData("request-talent", { fields: { form_started_at: v } });
    if (v === undefined) fd.delete("form_started_at");
    assert.equal((await handle("request-talent", makeRequest(fd), {})).status, 422);
  }
});

test("per-IP rate limiting returns 429 after the hourly allowance", async () => {
  const { handle } = makeHandler();
  let last;
  for (let i = 0; i < 6; i++) {
    const fd = makeFormData("request-talent", { fields: { email: `p${i}@example.com` } });
    last = await handle("request-talent", makeRequest(fd), { clientIp: "5.5.5.5" });
  }
  assert.equal(last.status, 429);
  assert.equal((await body(last)).retry, true);
  // a different IP is unaffected
  const other = await handle("request-talent",
    makeRequest(makeFormData("request-talent", { fields: { email: "x@example.com" } })), { clientIp: "6.6.6.6" });
  assert.equal(other.status, 200);
});
