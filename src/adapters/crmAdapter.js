const { normalizeDeal, normalizeContact } = require("../core/normalizers");
const { toIso, asDate } = require("../core/time");

class CrmAdapter {
  constructor(db, config) {
    this.db = db;
    this.config = config;
  }

  async listUsers(limit = 500) {
    const snap = await this.db.collection("users").limit(Math.max(1, Number(limit || 500))).get();
    return snap.docs.map(doc => {
      const d = doc.data() || {};
      return {
        id: doc.id,
        name: String(d.name || d.displayName || "").trim() || null,
        email: String(d.email || d.mail || "").trim().toLowerCase() || null,
        role: String(d.role || "").trim() || null,
        active: d.active !== false && d.disabled !== true
      };
    }).filter(x => x.active);
  }

  async getDeal(id) {
    if (!id) return null;
    const doc = await this.db.collection("deals").doc(String(id)).get();
    return doc.exists ? normalizeDeal(doc.id, doc.data()) : null;
  }

  async getContact(id) {
    if (!id) return null;
    const doc = await this.db.collection("contacts").doc(String(id)).get();
    return doc.exists ? normalizeContact(doc.id, doc.data()) : null;
  }

  async getDealNotes(dealId, limit = 20) {
    if (!dealId) return [];
    try {
      const snap = await this.db.collection("deals").doc(String(dealId)).collection("notes")
        .orderBy("createdAt", "desc").limit(Math.max(1, Number(limit || 20))).get();
      return snap.docs.map(doc => {
        const d = doc.data() || {};
        return {
          id: doc.id,
          note: String(d.note || d.text || d.body || d.content || "").trim(),
          user: String(d.user || d.author || d.userEmail || d.createdBy || "").trim(),
          createdAt: toIso(d.createdAt || d.timestamp || d.date)
        };
      });
    } catch (_) {
      return [];
    }
  }

  async findContactByPhone(phone) {
    const raw = String(phone || "").trim();
    if (!raw) return null;
    const candidates = Array.from(new Set([raw, raw.replace(/[^\d+]/g, ""), raw.replace(/\D/g, "")].filter(Boolean)));
    for (const field of ["phone", "whatsapp", "mobile", "phoneNumber", "waPhone"]) {
      for (const value of candidates) {
        try {
          const snap = await this.db.collection("contacts").where(field, "==", value).limit(1).get();
          if (!snap.empty) return normalizeContact(snap.docs[0].id, snap.docs[0].data());
        } catch (_) {}
      }
    }
    return null;
  }

  async listDeals(limit) {
    const max = Math.max(1, Number(limit || this.config.incremental.max_deals_per_run || 1500));
    const snap = await this.db.collection("deals").limit(max).get();
    return snap.docs.map(doc => normalizeDeal(doc.id, doc.data()));
  }

  async enrichDealContact(deal) {
    if (!deal) return deal;
    const contact = deal.contactId ? await this.getContact(deal.contactId) : null;
    const notes = await this.getDealNotes(deal.id, 20);
    const due = asDate(deal.dueDate);
    const explicitRecontacts = [deal.lastRecontactAt, deal.lastContactAt].map(asDate).filter(Boolean);
    const latestExplicit = explicitRecontacts.sort((a, b) => b - a)[0] || null;
    return {
      ...deal,
      contactName: contact?.company || contact?.name || deal.title,
      contact,
      dealNotes: notes,
      recontactEvidence: {
        status: latestExplicit && due && latestExplicit > due ? "confirmed" : "not_confirmed",
        method: latestExplicit ? "explicit_contact_timestamp" : "none",
        timestamp: latestExplicit ? latestExplicit.toISOString() : null,
        noteCount: notes.length,
        genericNotesNotCountedAsRecontact: true
      }
    };
  }
}

module.exports = { CrmAdapter };
