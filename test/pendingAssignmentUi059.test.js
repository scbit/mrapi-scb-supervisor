const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("validate UI exposes Pendientes de asignar button and action", () => {
  const html = fs.readFileSync(path.join(__dirname, "../public/validate.html"), "utf8");
  assert.equal(html.includes('data-action="pendingAssignment"'), true);
  assert.equal(html.includes("Pendientes de asignar"), true);
  assert.equal(html.includes('/api/core/pending-assignment'), true);
});
