const test = require('node:test');
const assert = require('node:assert/strict');
const { limitReached, buildRunDiagnostics } = require('../src/core/runDiagnostics');

test('limitReached identifies saturated source', () => {
  assert.equal(limitReached(250, 250), true);
  assert.equal(limitReached(249, 250), false);
});

test('diagnostics warns when source reaches configured cap', () => {
  const row = buildRunDiagnostics({ counts: { inbox: 250, crm: 10, hunter: 20, dailyState: 100 }, limits: { inbox: 250, crm: 1500, hunter: 5000, dailyState: 5000 } });
  assert.equal(row.healthy, false);
  assert.ok(row.warnings.includes('INBOX_LIMIT_REACHED'));
  assert.equal(row.saturation.crm, false);
});
