const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const pkg = require("../package.json");

test("validation UI is packaged and asks for TOKEN", () => {
  const html = fs.readFileSync(path.join(__dirname, "../public/validate.html"), "utf8");
  assert.equal(pkg.version, "0.5.2");
  assert.match(html, />TOKEN</);
  assert.match(html, /x-supervisor-token/);
  assert.match(html, /\/api\/core\/validate-sources/);
});
