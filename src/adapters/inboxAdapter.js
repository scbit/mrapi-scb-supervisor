const { normalizeConversation, normalizeMessage } = require("../core/normalizers");

class InboxAdapter {
  constructor(db, config) {
    this.db = db;
    this.config = config;
  }

  async listChangedConversations({ since, limit }) {
    const max = Math.max(1, Number(limit || this.config.incremental.max_conversations_per_run || 250));
    let query = this.db.collection("conversations").orderBy("lastMessageAt", "asc");
    if (since) query = query.where("lastMessageAt", ">=", since);
    const snap = await query.limit(max).get();
    return snap.docs.map(doc => normalizeConversation(doc.id, doc.data()));
  }

  async getConversation(conversationId) {
    const raw = String(conversationId || "").trim();
    const parts = raw.split("__");
    const candidates = [];
    const add = (value) => {
      const v = String(value || "").trim();
      if (v && !candidates.includes(v)) candidates.push(v);
    };

    add(raw);
    if (parts.length === 2) {
      const left = parts[0].replace(/^\+/, "");
      const right = parts[1].replace(/^\+/, "");
      add(`${left}__${right}`);
      add(`+${left}__${right}`);
      add(`${left}__+${right}`);
      add(`+${left}__+${right}`);
    }

    for (const id of candidates) {
      const doc = await this.db.collection("conversations").doc(id).get();
      if (doc.exists) {
        const normalized = normalizeConversation(doc.id, doc.data());
        normalized.lookupMatchedId = id;
        normalized.lookupCandidatesTried = candidates;
        return normalized;
      }
    }
    return null;
  }

  async getMessages(conversationId, limit) {
    const max = Math.max(1, Number(limit || this.config.incremental.max_messages_per_conversation || 500));
    let snap;
    try {
      snap = await this.db.collection(`conversations/${conversationId}/messages`)
        .orderBy("timestamp", "asc").limit(max).get();
    } catch (err) {
      snap = await this.db.collection(`conversations/${conversationId}/messages`).limit(max).get();
    }
    return snap.docs.map(doc => normalizeMessage(doc.id, doc.data()))
      .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
  }
}

module.exports = { InboxAdapter };
