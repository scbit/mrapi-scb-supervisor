const test = require("node:test");
const assert = require("node:assert/strict");
const { SOURCE_CONTRACTS } = require("../src/contracts/sourceContracts");

test("legacy source contracts preserve discovered collection names", () => {
  assert.equal(SOURCE_CONTRACTS.inbox.collections.conversations, "conversations");
  assert.equal(SOURCE_CONTRACTS.crm.collections.deals, "deals");
  assert.equal(SOURCE_CONTRACTS.crm.collections.users, "users");
  assert.equal(SOURCE_CONTRACTS.hunter.collections.notes, "hunter_notes");
  assert.equal(SOURCE_CONTRACTS.hunter.collections.prospects, "hunter_prospects");
  assert.equal(SOURCE_CONTRACTS.hunter.collections.tasks, "hunter_tasks");
});
