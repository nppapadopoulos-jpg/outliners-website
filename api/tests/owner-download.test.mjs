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

test('storage failures disclose only an allowlisted category to the authorized Owner', async () => {
  const secret = 'must-never-appear-in-response';
  const download = createOwnerDownload({ ownerPrincipalId: 'owner-1', storage: { async readSubmissionFile() { throw Object.assign(new Error(secret), { statusCode: 403 }); } } });
  const denied = await download({ principalId: 'other', submissionId: id });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('x-outliners-storage-failure'), null);
  const response = await download({ principalId: 'owner-1', submissionId: id });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('x-outliners-storage-failure'), 'access-denied');
  assert.equal(await response.text(), '');
  assert.ok(!JSON.stringify([...response.headers]).includes(secret));
});

test('identity endpoint errors are not mistaken for missing CVs', async () => {
  const download = createOwnerDownload({ ownerPrincipalId: 'owner-1', storage: { async readSubmissionFile() { throw Object.assign(new Error('redacted'), { name: 'AuthenticationError', statusCode: 404 }); } } });
  assert.equal((await download({ principalId: 'owner-1', submissionId: id })).headers.get('x-outliners-storage-failure'), 'identity');
});

test('missing containers are distinguished from missing blobs without exposing paths', async () => {
  for (const [code, category] of [['ContainerNotFound', 'container-missing'], ['BlobNotFound', 'missing-file']]) {
    const download = createOwnerDownload({ ownerPrincipalId: 'owner-1', storage: { async readSubmissionFile() { throw Object.assign(new Error('redacted'), { code, statusCode: 404 }); } } });
    assert.equal((await download({ principalId: 'owner-1', submissionId: id })).headers.get('x-outliners-storage-failure'), category);
  }
});
