const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const pkg = require("../package.json");

test("root index includes validation button", () => {
  const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
  assert.equal(pkg.version, "0.5.9");
  assert.match(html, /Ir a Validación \/ Core/);
  assert.match(html, /href="\/validate"/);
  assert.match(html, /href="\/health"/);
});
