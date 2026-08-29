class SupervisorStore {
  constructor(db) {
    this.db = db;
    this.collections = {
      conversations: 'supervisor_v3_conversation_state',
      deals: 'supervisor_v3_deal_state',
      hunterEvents: 'supervisor_v3_hunter_event_state',
      sellerDaily: 'supervisor_v3_seller_daily',
      followUp: 'supervisor_v3_follow_up_failures',
      checkpoints: 'supervisor_v3_checkpoints',
      runs: 'supervisor_v3_runs'
    };
  }

  async getCheckpoint(id = 'core') {
    const doc = await this.db.collection(this.collections.checkpoints).doc(id).get();
    return doc.exists ? doc.data() : null;
  }

  async saveCheckpoint(data, id = 'core') {
    await this.db.collection(this.collections.checkpoints).doc(id).set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
  }

  async getSourceCheckpoints() {
    const ids = ['inbox', 'crm', 'hunter'];
    const rows = await Promise.all(ids.map(async id => [id, await this.getCheckpoint(id)]));
    return Object.fromEntries(rows);
  }

  async getConversationState(id) {
    const doc = await this.db.collection(this.collections.conversations).doc(String(id)).get();
    return doc.exists ? doc.data() : null;
  }

  async saveConversationState(id, data) {
    await this.db.collection(this.collections.conversations).doc(String(id)).set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
  }

  async listConversationStatesForDay(dateYmd, limit = 5000) {
    try {
      const snap = await this.db.collection(this.collections.conversations)
        .where('activityDay', '==', String(dateYmd)).limit(Math.max(1, Number(limit || 5000))).get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (_) {
      return [];
    }
  }

  async listConversationStates(limit = 5000) {
    const snap = await this.db.collection(this.collections.conversations)
      .limit(Math.max(1, Number(limit || 5000))).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async listCurrentWaitingConversationStates(limit = 5000) {
    try {
      const snap = await this.db.collection(this.collections.conversations)
        .where('currentWaiting', '==', true)
        .limit(Math.max(1, Number(limit || 5000))).get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (_) {
      return [];
    }
  }

  async listUnassignedWaitingConversationStates(limit = 25) {
    try {
      const snap = await this.db.collection(this.collections.conversations)
        .where('currentWaiting', '==', true)
        .where('sellerId', '==', 'unknown')
        .limit(Math.max(1, Number(limit || 25))).get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (_) {
      return [];
    }
  }

  async listPendingAssignmentConversationStates(limit = 500) {
    try {
      const snap = await this.db.collection(this.collections.conversations)
        .where('currentWaiting', '==', true)
        .limit(Math.max(1, Number(limit || 500))).get();
      return snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(x => x.metrics?.pendingAssignment === true);
    } catch (_) {
      return [];
    }
  }

  async getDealState(id) {
    const doc = await this.db.collection(this.collections.deals).doc(String(id)).get();
    return doc.exists ? doc.data() : null;
  }

  async saveDealState(id, data) {
    await this.db.collection(this.collections.deals).doc(String(id)).set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
  }

  async getHunterEventState(id) {
    const doc = await this.db.collection(this.collections.hunterEvents).doc(String(id)).get();
    return doc.exists ? doc.data() : null;
  }

  async saveHunterEventState(id, data) {
    await this.db.collection(this.collections.hunterEvents).doc(String(id)).set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
  }

  async listHunterEventsForDay(dateYmd, limit = 10000) {
    const snap = await this.db.collection(this.collections.hunterEvents)
      .where('day', '==', String(dateYmd)).limit(Math.max(1, Number(limit || 10000))).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async replaceFollowUpFailures(rows, runId) {
    const col = this.db.collection(this.collections.followUp);
    const writer = this.db.bulkWriter();
    let count = 0;
    for (const row of rows || []) {
      const dealId = String(row.dealId);
      writer.set(col.doc(dealId), { ...row, active: row.severe === true, runId, updatedAt: new Date().toISOString() }, { merge: true });
      count += row.severe === true ? 1 : 0;
    }
    await writer.close();
    return count;
  }

  async listActiveFollowUpFailures(limit = 5000) {
    try {
      const snap = await this.db.collection(this.collections.followUp)
        .where('active', '==', true).limit(Math.max(1, Number(limit || 5000))).get();
      return snap.docs.map(doc => ({ dealId: doc.id, ...doc.data() }));
    } catch (_) {
      return [];
    }
  }

  async saveSellerDaily(dateYmd, sellers, runId) {
    const writer = this.db.bulkWriter();
    for (const seller of sellers || []) {
      const id = `${dateYmd}__${seller.sellerId}`;
      writer.set(this.db.collection(this.collections.sellerDaily).doc(id), {
        date: dateYmd,
        ...seller,
        runId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
    await writer.close();
  }

  async listSellerDaily(dateYmd, limit = 500) {
    const snap = await this.db.collection(this.collections.sellerDaily)
      .where('date', '==', String(dateYmd)).limit(Math.max(1, Number(limit || 500))).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async listWaitingConversations(_dateYmd, limit = 500) {
    const states = await this.listCurrentWaitingConversationStates(Math.max(limit * 5, 1000));
    return states.map(x => x.metrics).filter(x => x?.waitingForHuman)
      .sort((a, b) => Number(b.waitingMinutes || 0) - Number(a.waitingMinutes || 0)).slice(0, limit);
  }

  async getLatestRun() {
    try {
      const snap = await this.db.collection(this.collections.runs)
        .orderBy('startedAt', 'desc').limit(1).get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (_) {
      return null;
    }
  }

  async startRun(runId, data) {
    await this.db.collection(this.collections.runs).doc(runId).set({ ...data, status: 'RUNNING', startedAt: new Date().toISOString() });
  }

  async finishRun(runId, data) {
    await this.db.collection(this.collections.runs).doc(runId).set({ ...data, status: 'COMPLETE', finishedAt: new Date().toISOString() }, { merge: true });
  }

  async failRun(runId, error) {
    await this.db.collection(this.collections.runs).doc(runId).set({
      status: 'FAILED',
      error: String(error?.stack || error?.message || error),
      finishedAt: new Date().toISOString()
    }, { merge: true });
  }
}

module.exports = { SupervisorStore };
