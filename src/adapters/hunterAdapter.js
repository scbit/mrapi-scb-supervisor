const { toIso, asDate } = require('../core/time');

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
      return snap.docs.map(d => ({ id: d.id, eventType: 'management', ...d.data() }));
    } catch (err) {
      const snap = await this.db.collection(this.collections.notes).limit(limit).get();
      return snap.docs.map(d => ({ id: d.id, eventType: 'management', ...d.data() })).filter(row => {
        const d = asDate(row.createdAt);
        return d && d >= start && d < endExclusive;
      });
    }
  }

  async changedTasksForRange(start, endExclusive, limit = 2500) {
    const base = this.db.collection(this.collections.tasks);
    for (const field of ['updatedAt', 'completedAt', 'createdAt']) {
      try {
        const snap = await base.where(field, '>=', start.toISOString())
          .where(field, '<', endExclusive.toISOString()).orderBy(field, 'asc').limit(limit).get();
        return snap.docs.map(d => ({ id: `task:${d.id}`, eventType: 'task_state', sourceTaskId: d.id, ...d.data() }));
      } catch (_) {}
    }
    return [];
  }

  async listChangedEvents({ since, until = new Date(), limit = 5000 }) {
    const noteLimit = Math.max(1, Math.floor(limit * 0.75));
    const taskLimit = Math.max(1, limit - noteLimit);
    const [notes, tasks] = await Promise.all([
      this.managementsForRange(since, until, noteLimit),
      this.changedTasksForRange(since, until, taskLimit)
    ]);
    return [...notes, ...tasks].sort((a, b) => {
      const ad = asDate(a.createdAt || a.updatedAt || a.completedAt) || new Date(0);
      const bd = asDate(b.createdAt || b.updatedAt || b.completedAt) || new Date(0);
      return ad - bd;
    }).slice(0, limit);
  }

  async listChangedManagements(args) {
    return this.listChangedEvents(args);
  }

  aggregateBySeller(rows) {
    const map = new Map();
    for (const row of rows || []) {
      const key = String(row.userId || row.assignedTo || row.userName || row.assignedToName || 'unknown');
      if (!map.has(key)) {
        map.set(key, {
          rawSellerId: row.userId || row.assignedTo || null,
          rawSellerName: row.userName || row.assignedToName || row.userId || row.assignedTo || 'unknown',
          managements: 0,
          followUps: 0,
          taskCompletions: 0,
          taskReschedules: 0,
          openTasks: 0,
          overdueTasks: 0,
          results: {},
          lastActivityAt: null
        });
      }
      const item = map.get(key);
      if (row.eventType !== 'task_state') {
        item.managements += 1;
        if (row.isFollowUp === true) item.followUps += 1;
        if (row.taskCompleted === true || row.result === 'tarea_completada') item.taskCompletions += 1;
        if (row.result === 'tarea_reprogramada') item.taskReschedules += 1;
        const result = String(row.result || 'sin_resultado');
        item.results[result] = (item.results[result] || 0) + 1;
      } else {
        if (row.status === 'completed') item.taskCompletions += 1;
        else {
          item.openTasks += 1;
          const due = String(row.dueDate || '');
          const today = new Date().toISOString().slice(0, 10);
          if (due && due < today) item.overdueTasks += 1;
        }
      }
      const activityAt = toIso(row.createdAt || row.updatedAt || row.completedAt);
      if (activityAt && (!item.lastActivityAt || activityAt > item.lastActivityAt)) item.lastActivityAt = activityAt;
    }
    return [...map.values()];
  }
}

module.exports = { HunterAdapter };
