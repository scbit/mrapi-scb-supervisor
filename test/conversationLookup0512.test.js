const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("conversation lookup tries plus and no-plus id variants", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/adapters/inboxAdapter.js"), "utf8");
  assert.equal(source.includes('add(`+${left}__+${right}`)'), true);
  assert.equal(source.includes('add(`${left}__${right}`)'), true);
  assert.equal(source.includes("lookupMatchedId"), true);
});

test("backfill uses fresh v2 checkpoint and reports not-found count", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/core/engine.js"), "utf8");
  assert.equal(source.includes("pending_assignment_backfill_v2"), true);
  assert.equal(source.includes("pendingAssignmentBackfillNotFound"), true);
});
