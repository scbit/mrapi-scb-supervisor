const { FieldValue } = require("@google-cloud/firestore");

class SupervisorStore {
  constructor(db) {
    this.db = db;
    this.collections = {
      conversations: "supervisor_v3_conversation_state",
      sellerDaily: "supervisor_v3_seller_daily",
      followUp: "supervisor_v3_follow_up_failures",
      checkpoints: "supervisor_v3_checkpoints",
      runs: "supervisor_v3_runs"
    };
  }

  async getCheckpoint(id = "core") {
    const doc = await this.db.collection(this.collections.checkpoints).doc(id).get();
    return doc.exists ? doc.data() : null;
  }

  async saveCheckpoint(data, id = "core") {
    await this.db.collection(this.collections.checkpoints).doc(id).set({
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }

  async getConversationState(id) {
    const doc = await this.db.collection(this.collections.conversations).doc(String(id)).get();
    return doc.exists ? doc.data() : null;
  }

  async saveConversationState(id, data) {
    await this.db.collection(this.collections.conversations).doc(String(id)).set({
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }

  async replaceFollowUpFailures(rows, runId) {
    const col = this.db.collection(this.collections.followUp);
    const severe = (rows || []).filter(x => x.severe);
    const writer = this.db.bulkWriter();
    for (const row of severe) {
      writer.set(col.doc(String(row.dealId)), { ...row, runId, updatedAt: new Date().toISOString() }, { merge: true });
    }
    await writer.close();
    return severe.length;
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

  async startRun(runId, data) {
    await this.db.collection(this.collections.runs).doc(runId).set({
      ...data,
      status: "RUNNING",
      startedAt: new Date().toISOString()
    });
  }

  async finishRun(runId, data) {
    await this.db.collection(this.collections.runs).doc(runId).set({
      ...data,
      status: "COMPLETE",
      finishedAt: new Date().toISOString()
    }, { merge: true });
  }

  async failRun(runId, error) {
    await this.db.collection(this.collections.runs).doc(runId).set({
      status: "FAILED",
      error: String(error?.stack || error?.message || error),
      finishedAt: new Date().toISOString()
    }, { merge: true });
  }
}

module.exports = { SupervisorStore };
