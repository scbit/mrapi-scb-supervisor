const test = require('node:test');
const assert = require('node:assert/strict');
const { HunterAdapter } = require('../src/adapters/hunterAdapter');

test('hunter aggregation combines management and task state events', () => {
  const adapter = new HunterAdapter(null);
  const rows = [
    { eventType: 'management', userId: 'u1', userName: 'Ana', result: 'contactado', isFollowUp: true, createdAt: '2026-08-28T13:00:00Z' },
    { eventType: 'management', userId: 'u1', userName: 'Ana', result: 'tarea_reprogramada', createdAt: '2026-08-28T14:00:00Z' },
    { eventType: 'task_state', assignedTo: 'u1', assignedToName: 'Ana', status: 'completed', updatedAt: '2026-08-28T15:00:00Z' }
  ];
  const result = adapter.aggregateBySeller(rows)[0];
  assert.equal(result.managements, 2);
  assert.equal(result.followUps, 1);
  assert.equal(result.taskReschedules, 1);
  assert.equal(result.taskCompletions, 1);
  assert.equal(result.results.contactado, 1);
});
