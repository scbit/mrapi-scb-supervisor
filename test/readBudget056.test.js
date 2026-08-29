const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("read budgets are bounded", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "../config/supervisor.default.json"), "utf8"));
  assert.equal(cfg.incremental.max_conversations_per_run, 250);
  assert.equal(cfg.incremental.max_deals_per_run, 250);
  assert.equal(cfg.incremental.max_unassigned_resolution_per_run, 25);
});

test("known technical CRM accounts are excluded explicitly", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "../config/supervisor.default.json"), "utf8"));
  const excluded = new Set(cfg.seller_roster.exclude_emails);
  assert.equal(excluded.has("admin@scb.com"), true);
  assert.equal(excluded.has("marketing@sentirecustomsbroker.com"), true);
  assert.equal(excluded.has("mrapi@mrapi.us"), true);
});

test("courtesy filter includes Okey gracias", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "../config/supervisor.default.json"), "utf8"));
  assert.equal(cfg.response.terminal_courtesy_phrases.includes("okey gracias"), true);
});
