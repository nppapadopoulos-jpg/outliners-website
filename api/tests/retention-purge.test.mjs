import test from 'node:test';
import assert from 'node:assert/strict';
import { purgeExpired } from '../src/core/retention-purge.js';

test('dry run does not delete and active purge deletes only expired records', async () => {
  const removed = [];
  const storage = {
    async *list() {
      yield { relPath: 'old', record: { id: 'a', deleteAfter: '2025-01-01T00:00:00Z' } };
      yield { relPath: 'new', record: { id: 'b', deleteAfter: '2027-01-01T00:00:00Z' } };
    },
    async deleteSubmission(path) { removed.push(path); },
  };
  const now = Date.parse('2026-11-02T00:00:00Z');
  const preview = await purgeExpired({ storage, now });
  assert.equal(preview.expired, 1);
  assert.equal(preview.deleted, 0);
  assert.deepEqual(removed, []);
  const actual = await purgeExpired({ storage, now, dryRun: false });
  assert.equal(actual.deleted, 1);
  assert.deepEqual(removed, ['old']);
});
