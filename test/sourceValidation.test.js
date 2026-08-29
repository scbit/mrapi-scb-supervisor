"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { inspectCollection, validateSources } = require("../src/core/sourceValidation");

function fakeDb(rowsByCollection = {}) {
  return {
    collection(name) {
      return {
        limit() {
          return {
            async get() {
              const row = rowsByCollection[name];
              return { docs: row ? [{ data: () => row }] : [] };
            }
          };
        }
      };
    }
  };
}

test("inspectCollection returns keys but not values", async () => {
  const result = await inspectCollection(fakeDb({ conversations: { phone: "+secret", owner: "private", lastMessageAt: "x" } }), "conversations");
  assert.equal(result.reachable, true);
  assert.deepEqual(result.sampleKeys, ["lastMessageAt", "owner", "phone"]);
  assert.equal(JSON.stringify(result).includes("+secret"), false);
  assert.equal(JSON.stringify(result).includes("private"), false);
});

test("validateSources uses legacy-compatible database map", async () => {
  const db = fakeDb();
  const databases = {
    inbox: db, crm: db, hunter: db, supervisor: db,
    ids: { inboxDatabaseId: "bsscb", crmDatabaseId: "bscrmscb", hunterDatabaseId: "scb-hunter-bd", supervisorDatabaseId: "bsscb" }
  };
  const result = await validateSources(databases);
  assert.equal(result.readOnly, true);
  assert.equal(result.sources.inbox.databaseId, "bsscb");
  assert.equal(result.sources.crm.databaseId, "bscrmscb");
  assert.equal(result.sources.hunter.databaseId, "scb-hunter-bd");
});
