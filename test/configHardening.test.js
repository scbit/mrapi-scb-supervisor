const test = require('node:test');
const assert = require('node:assert/strict');
const { validateConfig, numberEnv } = require('../src/config');
const base = require('../config/supervisor.default.json');

test('validateConfig accepts default config', () => {
  assert.equal(validateConfig(JSON.parse(JSON.stringify(base))).timezone, 'America/Argentina/Buenos_Aires');
});

test('validateConfig rejects non-positive incremental limits', () => {
  const cfg = JSON.parse(JSON.stringify(base));
  cfg.incremental.max_conversations_per_run = 0;
  assert.throws(() => validateConfig(cfg), /max_conversations_per_run/);
});

test('numberEnv rejects unsafe override', () => {
  const previous = process.env.TEST_LIMIT;
  process.env.TEST_LIMIT = '999';
  try { assert.throws(() => numberEnv('TEST_LIMIT', 1, { min: 1, max: 100 }), /Invalid TEST_LIMIT/); }
  finally { if (previous === undefined) delete process.env.TEST_LIMIT; else process.env.TEST_LIMIT = previous; }
});
