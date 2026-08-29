const test = require('node:test');
const assert = require('node:assert/strict');
const { aggregateSeller, percentile } = require('../src/core/aggregate');

const config = {
  timezone: 'America/Argentina/Buenos_Aires',
  business_hours: { weekdays: [1,2,3,4,5], start: '09:00', end: '17:00' },
  seller_activity: { active_within_minutes: 45 }
};

test('seller response average is weighted by measured responses, not conversations', () => {
  const result = aggregateSeller({
    seller: { id: 's1', label: 'Seller', source: 'mapped' },
    conversations: [
      { responseMinutes: [1, 2, 3], responseMinutesTotal: 6, responsesCount: 3, humanOutboundCount: 3 },
      { responseMinutes: [20], responseMinutesTotal: 20, responsesCount: 1, humanOutboundCount: 1 }
    ],
    config,
    now: new Date('2026-08-28T15:00:00-03:00')
  });
  assert.equal(result.avgResponseMinutes, 7);
  assert.equal(result.responsesMeasured, 4);
  assert.equal(result.p95ResponseMinutes, 20);
});

test('waiting cases are ordered from longest wait to shortest', () => {
  const result = aggregateSeller({
    seller: { id: 's1', label: 'Seller', source: 'mapped' },
    conversations: [
      { conversationId: 'a', waitingForHuman: true, waitingMinutes: 10, humanOutboundCount: 0 },
      { conversationId: 'b', waitingForHuman: true, waitingMinutes: 35, humanOutboundCount: 0 }
    ],
    config,
    now: new Date('2026-08-28T15:00:00-03:00')
  });
  assert.deepEqual(result.waitingCases.map(x => x.conversationId), ['b', 'a']);
});

test('percentile handles deterministic values', () => {
  assert.equal(percentile([1, 5, 2, 20, 4], 95), 20);
  assert.equal(percentile([], 95), null);
});
