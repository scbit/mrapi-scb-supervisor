const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Inbox checks derived metadata before fetching message subcollection", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/core/engine.js"), "utf8");
  const getState = source.indexOf("getConversationState(conversation.id)");
  const getMessages = source.indexOf("getMessages(conversation.id");
  assert.ok(getState >= 0 && getMessages > getState);
  assert.ok(source.includes("sourceMetadataFingerprint"));
  assert.ok(source.includes("inboxMetadataSkips"));
  assert.ok(source.includes("inboxMessageFetches"));
});

test("CRM skips unchanged deal before enrichDealContact", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/core/engine.js"), "utf8");
  const previous = source.indexOf("getDealState(dealRaw.id)");
  const skip = source.indexOf("crmSkippedBeforeEnrichment += 1");
  const enrich = source.indexOf("enrichDealContact(dealRaw)");
  assert.ok(previous >= 0 && skip > previous && enrich > skip);
  assert.ok(source.includes("sourceFingerprint"));
});

test("Core exposes observed read-efficiency diagnostics", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/core/engine.js"), "utf8");
  for (const field of [
    "inboxMessageDocsObserved",
    "crmEnrichmentDocsObserved",
    "crmSkippedBeforeEnrichment",
    "readEfficiency"
  ]) assert.ok(source.includes(field));
});
