const test = require('node:test');
const assert = require('node:assert/strict');
const { cursorWithLookback, advanceCursor, stableFingerprint } = require('../src/core/incremental');

test('cursorWithLookback subtracts overlap from prior cursor', () => {
  const result = cursorWithLookback('2026-08-28T15:00:00.000Z', 120, new Date('2026-08-28T20:00:00.000Z'));
  assert.equal(result.toISOString(), '2026-08-28T13:00:00.000Z');
});

test('cursorWithLookback uses bounded bootstrap window without prior cursor', () => {
  const result = cursorWithLookback(null, 120, new Date('2026-08-28T20:00:00.000Z'), 24);
  assert.equal(result.toISOString(), '2026-08-27T20:00:00.000Z');
});

test('advanceCursor never moves backwards', () => {
  const result = advanceCursor('2026-08-28T15:00:00.000Z', [
    '2026-08-28T14:00:00.000Z',
    '2026-08-28T16:30:00.000Z'
  ]);
  assert.equal(result, '2026-08-28T16:30:00.000Z');
});

test('stableFingerprint ignores object key ordering', () => {
  assert.equal(stableFingerprint({ b: 2, a: 1 }), stableFingerprint({ a: 1, b: 2 }));
  assert.notEqual(stableFingerprint({ a: 1 }), stableFingerprint({ a: 2 }));
});
