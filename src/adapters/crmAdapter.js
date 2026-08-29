const { normalizeDeal, normalizeContact } = require("../core/normalizers");

class CrmAdapter {
  constructor(db, config) {
    this.db = db;
    this.config = config;
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

  async findContactByPhone(phone) {
    const raw = String(phone || "").trim();
    if (!raw) return null;
    const candidates = Array.from(new Set([
      raw,
      raw.replace(/[^\d+]/g, ""),
      raw.replace(/\D/g, "")
    ].filter(Boolean)));
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
    if (!deal?.contactId) return deal;
    const contact = await this.getContact(deal.contactId);
    if (!contact) return deal;
    return { ...deal, contactName: contact.company || contact.name || deal.title, contact };
  }
}

module.exports = { CrmAdapter };
