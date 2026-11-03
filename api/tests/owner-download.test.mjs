import test from "node:test";
import assert from "node:assert/strict";
import { createOwnerDownload } from "../src/core/owner-download.js";
const id = "b07d94a5-4d3f-432d-90a3-324980984e15";
test("owner download denies anonymous and other users before storage access", async () => {
  let reads = 0;
  const download = createOwnerDownload({ ownerPrincipalId: "owner-1", storage: { async readSubmissionFile() { reads++; return { bytes: Buffer.from("test") }; } } });
  assert.equal((await download({ submissionId: id })).status, 403);
  assert.equal((await download({ principalId: "other", submissionId: id })).status, 403);
  assert.equal(reads, 0);
});
test("owner download validates IDs and returns non-cacheable attachment", async () => {
  const download = createOwnerDownload({ ownerPrincipalId: "owner-1", storage: { async readSubmissionFile() { return { bytes: Buffer.from("sample") }; } } });
  assert.equal((await download({ principalId: "owner-1", submissionId: "../secrets" })).status, 400);
  const response = await download({ principalId: "owner-1", submissionId: id });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, private");
  assert.equal(await response.text(), "sample");
});
