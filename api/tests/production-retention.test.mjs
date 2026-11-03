import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, assertProductionConfig } from '../src/core/config.js';

test('production requires 12 calendar months', () => {
  const base = { NODE_ENV: 'production', IP_HASH_SALT: 'nondefault-random-value' };
  assert.throws(() => assertProductionConfig(loadConfig(base)), /RETENTION_MONTHS/);
  assert.throws(() => assertProductionConfig(loadConfig({ ...base, RETENTION_DAYS: '365' })), /RETENTION_MONTHS/);
  assert.doesNotThrow(() => assertProductionConfig(loadConfig({ ...base, RETENTION_MONTHS: '12' })));
});
