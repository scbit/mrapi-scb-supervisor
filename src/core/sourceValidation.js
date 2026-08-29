"use strict";

async function inspectCollection(db, name) {
  const started = Date.now();
  try {
    const snap = await db.collection(name).limit(1).get();
    const first = snap.docs[0];
    return {
      collection: name,
      reachable: true,
      sampleFound: Boolean(first),
      sampleKeys: first ? Object.keys(first.data() || {}).sort() : [],
      durationMs: Date.now() - started
    };
  } catch (error) {
    return {
      collection: name,
      reachable: false,
      sampleFound: false,
      sampleKeys: [],
      error: String(error?.code || error?.message || error),
      durationMs: Date.now() - started
    };
  }
}

async function validateSources(databases) {
  const specs = {
    inbox: {
      db: databases.inbox,
      databaseId: databases.ids.inboxDatabaseId,
      collections: ["conversations", "users"]
    },
    crm: {
      db: databases.crm,
      databaseId: databases.ids.crmDatabaseId,
      collections: ["deals", "contacts", "users"]
    },
    hunter: {
      db: databases.hunter,
      databaseId: databases.ids.hunterDatabaseId,
      collections: ["hunter_prospects", "hunter_notes", "hunter_tasks", "hunter_users"]
    },
    supervisor: {
      db: databases.supervisor,
      databaseId: databases.ids.supervisorDatabaseId,
      collections: ["supervisor_v3_checkpoints", "supervisor_v3_runs"]
    }
  };

  const out = {};
  for (const [source, spec] of Object.entries(specs)) {
    const collections = [];
    for (const name of spec.collections) collections.push(await inspectCollection(spec.db, name));
    out[source] = {
      databaseId: spec.databaseId,
      reachable: collections.some(x => x.reachable),
      collections
    };
  }

  return {
    checkedAt: new Date().toISOString(),
    readOnly: true,
    sources: out
  };
}

module.exports = { inspectCollection, validateSources };
