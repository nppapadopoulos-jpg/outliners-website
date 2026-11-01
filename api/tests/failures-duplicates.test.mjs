import test from "node:test";
import assert from "node:assert/strict";
import { makeHandler, makeFormData, makeRequest, body } from "./helpers.mjs";

test("storage failure returns a sanitized 502 and sends no email", async () => {
  const { handle, sent, logs } = makeHandler({ storageFails: true });
  const res = await handle("request-talent", makeRequest(makeFormData("request-talent")), {});
  const b = await body(res);
  assert.equal(res.status, 502);
  assert.deepEqual(b, { ok: false, retry: true });
  assert.equal(sent.length, 0);
  assert.ok(logs.some(l => l.includes("storage-failed")));
  assert.ok(!logs.some(l => l.includes("person@example.com")), "no personal data in failure logs");
});

test("email failure after successful storage still returns 200 (submission not lost)", async () => {
  const { handle, stored, logs } = makeHandler({ emailFails: true });
  const res = await handle("submit-cv", makeRequest(makeFormData("submit-cv")), {});
  const b = await body(res);
  assert.equal(res.status, 200);
  assert.equal(b.ok, true);
  assert.equal(stored.length, 1);
  assert.ok(logs.some(l => l.includes("notify-failed")));
  assert.ok(logs.some(l => l.includes('"outcome":"stored"')));
});

test("duplicate submission within the window is acknowledged once, stored once, notified once", async () => {
  const { handle, stored, sent } = makeHandler();
  const first = await body(await handle("submit-cv", makeRequest(makeFormData("submit-cv")), { clientIp: "1.2.3.4" }));
  const second = await body(await handle("submit-cv", makeRequest(makeFormData("submit-cv")), { clientIp: "1.2.3.4" }));
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(second.id, first.id);
  assert.equal(stored.length, 1);
  assert.equal(sent.length, 1);
});

test("a different candidate is not treated as a duplicate", async () => {
  const { handle, stored } = makeHandler();
  await handle("submit-cv", makeRequest(makeFormData("submit-cv")), {});
  const fd = makeFormData("submit-cv", { fields: { email: "other@example.com" } });
  const res = await handle("submit-cv", makeRequest(fd), {});
  assert.equal(res.status, 200);
  assert.equal(stored.length, 2);
});
