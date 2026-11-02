import test from "node:test";
import assert from "node:assert/strict";
import { makeHandler, makeFormData, makeRequest, body, testConfig } from "./helpers.mjs";
import { ipHash, createLogger, deleteAfter, deleteAfterMonths } from "../src/core/privacy.js";

const PERSONAL = ["Maria Papadaki", "maria.papadaki@example.org", "+30 699 123 4567", "maria-cv.pdf"];

test("audit logs never contain personal data; IPs are salted hashes", async () => {
  const { handle, logs } = makeHandler();
  const fd = makeFormData("submit-cv", {
    fields: { full_name: PERSONAL[0], email: PERSONAL[1], phone: PERSONAL[2] },
    file: { name: PERSONAL[3], bytes: (await import("./helpers.mjs")).pdfBytes() },
  });
  const res = await handle("submit-cv", makeRequest(fd), { clientIp: "203.0.113.77" });
  assert.equal(res.status, 200);
  const all = logs.join("\n");
  for (const value of PERSONAL) assert.ok(!all.includes(value), `log leaked: ${value}`);
  assert.ok(!all.includes("203.0.113.77"), "raw IP must never be logged");
  assert.ok(all.includes(ipHash("203.0.113.77", "test-salt")), "salted hash is logged for audit");
});

test("the logger drops any key outside its allow-list by construction", () => {
  const lines = [];
  const logger = createLogger(l => lines.push(l));
  logger.info({ event: "x", email: "leak@example.com", cv: "contents", ipHash: "abc" });
  assert.ok(!lines[0].includes("leak@example.com") && !lines[0].includes("contents"));
  assert.ok(lines[0].includes('"ipHash":"abc"'));
});

test("retention: deleteAfter is null (flagged) until the owner sets RETENTION_DAYS", async () => {
  const { handle, stored } = makeHandler();
  await handle("request-talent", makeRequest(makeFormData("request-talent")), {});
  assert.equal(stored[0].record.deleteAfter, null);
});

test("retention: with RETENTION_DAYS set, records carry a deterministic deleteAfter", async () => {
  const { handle, stored } = makeHandler({ config: { retentionDays: 180 } });
  await handle("request-talent", makeRequest(makeFormData("request-talent")), {});
  const d = new Date(stored[0].record.deleteAfter) - Date.now();
  assert.ok(Math.abs(d - 180 * 86400_000) < 60_000);
  assert.equal(deleteAfter(null), null);
});

test("data minimization: control fields are not stored; consent is stored as an event, not a blob of text", async () => {
  const { handle, stored } = makeHandler();
  await handle("request-talent", makeRequest(makeFormData("request-talent")), {});
  const record = stored[0].record;
  assert.ok(!("website" in record.fields) && !("form_started_at" in record.fields));
  assert.equal(record.consent.value, "yes");
  assert.ok(record.consent.recordedAt);
});

test("twelve calendar months handle leap days", () => {
  assert.equal(deleteAfterMonths(12, Date.parse("2024-02-29T12:00:00Z")), "2025-02-28T12:00:00.000Z");
  assert.equal(deleteAfterMonths(12, Date.parse("2025-03-01T12:00:00Z")), "2026-03-01T12:00:00.000Z");
  assert.equal(deleteAfterMonths(null), null);
});

test("handler records calendar-month deletion deadline", async () => {
  const { handle, stored } = makeHandler({ config: { retentionMonths: 12 } });
  await handle("request-talent", makeRequest(makeFormData("request-talent")), {});
  assert.equal(stored[0].record.deleteAfter, deleteAfterMonths(12, Date.parse(stored[0].record.receivedAt)));
});
