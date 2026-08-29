const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("CRM adapter imports FieldPath from declared Firestore dependency", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));
  const source = fs.readFileSync(path.join(__dirname, "../src/adapters/crmAdapter.js"), "utf8");
  assert.equal(Boolean(pkg.dependencies["@google-cloud/firestore"]), true);
  assert.equal(source.includes("require('@google-cloud/firestore')"), true);
  assert.equal(source.includes("firebase-admin/firestore"), false);
});
