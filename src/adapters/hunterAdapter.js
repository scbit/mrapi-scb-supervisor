const { toIso } = require("../core/time");

class HunterAdapter {
  constructor(db) {
    this.db = db;
  }

  async listUsers() {
    const snap = await this.db.collection("hunter_users").limit(500).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.active !== false);
  }

  async managementsForRange(start, endExclusive, limit = 5000) {
    let ref = this.db.collection("hunter_notes");
    try {
      ref = ref.where("createdAt", ">=", start.toISOString())
        .where("createdAt", "<", endExclusive.toISOString());
      const snap = await ref.limit(limit).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      // Fallback is bounded. Filtering stays deterministic and local.
      const snap = await this.db.collection("hunter_notes").limit(limit).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(row => {
        const d = new Date(row.createdAt || 0);
        return d >= start && d < endExclusive;
      });
    }
  }

  aggregateBySeller(rows) {
    const map = new Map();
    for (const row of rows || []) {
      const key = String(row.userId || row.userName || "unknown");
      if (!map.has(key)) {
        map.set(key, {
          rawSellerId: row.userId || null,
          rawSellerName: row.userName || row.userId || "unknown",
          managements: 0,
          results: {},
          lastActivityAt: null
        });
      }
      const item = map.get(key);
      item.managements += 1;
      const result = String(row.result || "sin_resultado");
      item.results[result] = (item.results[result] || 0) + 1;
      if (!item.lastActivityAt || String(row.createdAt || "") > item.lastActivityAt) {
        item.lastActivityAt = toIso(row.createdAt) || row.createdAt || null;
      }
    }
    return [...map.values()];
  }
}

module.exports = { HunterAdapter };
