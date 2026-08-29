const { toIso } = require('../core/time');

class HunterAdapter {
  constructor(db) {
    this.db = db;
    this.collections = {
      prospects: 'hunter_prospects',
      notes: 'hunter_notes',
      tasks: 'hunter_tasks',
      users: 'hunter_users'
    };
  }

  async listUsers() {
    const snap = await this.db.collection(this.collections.users).limit(500).get();
    return snap.docs.map(d => {
      const row = d.data() || {};
      return {
        id: d.id,
        name: String(row.name || row.displayName || row.userName || '').trim() || null,
        email: String(row.email || row.mail || '').trim().toLowerCase() || null,
        role: String(row.role || 'seller').trim() || 'seller',
        active: row.active !== false && row.disabled !== true
      };
    }).filter(x => x.active);
  }

  async managementsForRange(start, endExclusive, limit = 5000) {
    let ref = this.db.collection(this.collections.notes);
    try {
      ref = ref.where('createdAt', '>=', start.toISOString())
        .where('createdAt', '<', endExclusive.toISOString()).orderBy('createdAt', 'asc');
      const snap = await ref.limit(limit).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      const snap = await this.db.collection(this.collections.notes).limit(limit).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(row => {
        const d = new Date(row.createdAt || 0);
        return d >= start && d < endExclusive;
      });
    }
  }

  async listChangedManagements({ since, until = new Date(), limit = 5000 }) {
    return this.managementsForRange(since, until, limit);
  }

  aggregateBySeller(rows) {
    const map = new Map();
    for (const row of rows || []) {
      const key = String(row.userId || row.userName || 'unknown');
      if (!map.has(key)) {
        map.set(key, {
          rawSellerId: row.userId || null,
          rawSellerName: row.userName || row.userId || 'unknown',
          managements: 0,
          followUps: 0,
          taskCompletions: 0,
          taskReschedules: 0,
          results: {},
          lastActivityAt: null
        });
      }
      const item = map.get(key);
      item.managements += 1;
      if (row.isFollowUp === true) item.followUps += 1;
      if (row.taskCompleted === true || row.result === 'tarea_completada') item.taskCompletions += 1;
      if (row.result === 'tarea_reprogramada') item.taskReschedules += 1;
      const result = String(row.result || 'sin_resultado');
      item.results[result] = (item.results[result] || 0) + 1;
      if (!item.lastActivityAt || String(row.createdAt || '') > item.lastActivityAt) {
        item.lastActivityAt = toIso(row.createdAt) || row.createdAt || null;
      }
    }
    return [...map.values()];
  }
}

module.exports = { HunterAdapter };
