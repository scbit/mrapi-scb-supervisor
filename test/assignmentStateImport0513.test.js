const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("engine imports assignmentState used by pending backfill", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/core/engine.js"), "utf8");
  assert.match(
    source,
    /const \{[^}]*assignmentState[^}]*\} = require\('\.\/conversationMetrics'\);/
  );
  assert.equal(source.includes("const assignment = assignmentState(sourceConversation"), true);
});
