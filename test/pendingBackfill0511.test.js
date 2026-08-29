const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("InboxAdapter exposes bounded direct conversation lookup", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/adapters/inboxAdapter.js"), "utf8");
  assert.equal(source.includes("async getConversation(conversationId)"), true);
  assert.equal(source.includes('.doc(id).get()'), true);
});

test("engine includes one-time bounded pending assignment backfill", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/core/engine.js"), "utf8");
  assert.equal(source.includes("pending_assignment_backfill_v2"), true);
  assert.equal(source.includes("Math.min(100"), true);
  assert.equal(source.includes("this.inbox.getConversation(state.id)"), true);
  assert.equal(source.includes("pendingAssignmentBackfilled"), true);
});
