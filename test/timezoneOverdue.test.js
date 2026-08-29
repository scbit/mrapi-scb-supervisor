const test = require('node:test');
const assert = require('node:assert/strict');
const { daysOverdue } = require('../src/core/time');

test('daysOverdue uses operational timezone day boundaries', () => {
  // 02:30Z is still the previous day in Buenos Aires (UTC-03).
  const due = '2026-08-20T15:00:00.000Z';
  const asOf = '2026-08-28T02:30:00.000Z';
  assert.equal(daysOverdue(due, asOf, 'America/Argentina/Buenos_Aires'), 7);
});
