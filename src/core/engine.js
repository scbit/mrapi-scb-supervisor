const crypto = require("crypto");
const { analyzeConversation, messageFingerprint } = require("./conversationMetrics");
const { evaluateSevereFollowUp } = require("./followUp");
const { aggregateSeller } = require("./aggregate");
const { SellerIdentityResolver } = require("./sellerIdentity");
const { localDayRange, asDate } = require("./time");

class SupervisorEngine {
  constructor({ config, inbox, crm, hunter, store }) {
    this.config = config;
    this.inbox = inbox;
    this.crm = crm;
    this.hunter = hunter;
    this.store = store;
    this.identities = new SellerIdentityResolver(config);
  }

  async resolveConversationSeller(conversation, messages, cache = new Map()) {
    const human = [...(messages || [])].reverse().find(m => m.actor === "human" && m.user);
    if (human?.user) return this.identities.resolve(human.user);

    if (conversation.owner) return this.identities.resolve(conversation.owner);

    if (conversation.dealId) {
      const key = `deal:${conversation.dealId}`;
      if (!cache.has(key)) cache.set(key, await this.crm.getDeal(conversation.dealId));
      const deal = cache.get(key);
      if (deal?.owner) return this.identities.resolve(deal.owner);
    }

    if (conversation.contactId) {
      const key = `contact:${conversation.contactId}`;
      if (!cache.has(key)) cache.set(key, await this.crm.getContact(conversation.contactId));
      const contact = cache.get(key);
      if (contact?.owner) return this.identities.resolve(contact.owner);
    }

    if (conversation.phone) {
      const key = `phone:${conversation.phone}`;
      if (!cache.has(key)) cache.set(key, await this.crm.findContactByPhone(conversation.phone));
      const contact = cache.get(key);
      if (contact?.owner) return this.identities.resolve(contact.owner);
    }

    return this.identities.resolve("unknown");
  }

  async run({ now = new Date(), forceSince = null } = {}) {
    const runId = crypto.randomUUID();
    const cfg = this.config;
    const checkpoint = await this.store.getCheckpoint("core");
    const lookbackMinutes = Number(cfg.incremental.lookback_minutes || 120);
    const previous = forceSince || checkpoint?.conversationCursor || null;
    const since = previous
      ? new Date(asDate(previous).getTime() - lookbackMinutes * 60000)
      : new Date(now.getTime() - 24 * 60 * 60000);

    await this.store.startRun(runId, {
      mode: "incremental",
      since: since.toISOString(),
      sourceCheckpoint: previous || null
    });

    try {
      const [crmUsers, hunterUsers] = await Promise.all([
        this.crm.listUsers().catch(() => []),
        this.hunter.listUsers().catch(() => [])
      ]);
      for (const user of crmUsers) this.identities.registerCrmUser(user);
      for (const user of hunterUsers) this.identities.registerHunterUser(user);
      const conversations = await this.inbox.listChangedConversations({
        since,
        limit: cfg.incremental.max_conversations_per_run
      });

      const analyzed = [];
      const sellerCache = new Map();
      let skippedUnchanged = 0;
      let cursor = previous ? asDate(previous) : null;

      for (const conversation of conversations) {
        const messages = await this.inbox.getMessages(
          conversation.id,
          cfg.incremental.max_messages_per_conversation
        );
        const fingerprint = messageFingerprint(conversation, messages);
        const previousState = await this.store.getConversationState(conversation.id);

        const lm = asDate(conversation.lastMessageAt);
        if (lm && (!cursor || lm > cursor)) cursor = lm;

        if (previousState?.fingerprint === fingerprint) {
          skippedUnchanged += 1;
          if (previousState.metrics) analyzed.push(previousState.metrics);
          continue;
        }

        const seller = await this.resolveConversationSeller(conversation, messages, sellerCache);
        const metrics = analyzeConversation(conversation, messages, {
          lateAfterMinutes: cfg.response.late_after_minutes,
          now
        });
        metrics.seller = seller;

        await this.store.saveConversationState(conversation.id, {
          fingerprint,
          sourceLastMessageAt: conversation.lastMessageAt,
          seller,
          metrics
        });
        analyzed.push(metrics);
      }

      const deals = await this.crm.listDeals(cfg.incremental.max_deals_per_run);
      const followUps = [];
      for (const dealRaw of deals) {
        const deal = await this.crm.enrichDealContact(dealRaw);
        followUps.push(evaluateSevereFollowUp(deal, cfg, now));
      }
      await this.store.replaceFollowUpFailures(followUps, runId);

      const day = localDayRange(now, cfg.timezone);
      const hunterRows = await this.hunter.managementsForRange(day.start, day.endExclusive);
      const hunterRaw = this.hunter.aggregateBySeller(hunterRows);

      const convBySeller = new Map();
      for (const row of analyzed) {
        const seller = row.seller || this.identities.resolve(row.owner || "unknown");
        if (!convBySeller.has(seller.id)) convBySeller.set(seller.id, { seller, rows: [] });
        convBySeller.get(seller.id).rows.push(row);
      }

      const hunterBySeller = new Map();
      for (const h of hunterRaw) {
        const seller = this.identities.resolve(h.rawSellerId, h.rawSellerName);
        hunterBySeller.set(seller.id, { seller, metrics: h });
      }

      const followBySeller = new Map();
      for (const f of followUps.filter(x => x.severe)) {
        const seller = this.identities.resolve(f.seller || "unknown");
        if (!followBySeller.has(seller.id)) followBySeller.set(seller.id, { seller, rows: [] });
        followBySeller.get(seller.id).rows.push(f);
      }

      const sellerIds = new Set([
        ...convBySeller.keys(),
        ...hunterBySeller.keys(),
        ...followBySeller.keys()
      ]);

      const sellers = [];
      for (const id of sellerIds) {
        const seller =
          convBySeller.get(id)?.seller ||
          hunterBySeller.get(id)?.seller ||
          followBySeller.get(id)?.seller ||
          this.identities.resolve(id);
        sellers.push(aggregateSeller({
          seller,
          conversations: convBySeller.get(id)?.rows || [],
          hunter: hunterBySeller.get(id)?.metrics || null,
          followUps: followBySeller.get(id)?.rows || [],
          config: cfg,
          now
        }));
      }

      await this.store.saveSellerDaily(day.ymd, sellers, runId);
      if (cursor) await this.store.saveCheckpoint({ conversationCursor: cursor.toISOString(), lastRunId: runId }, "core");

      const summary = {
        runId,
        date: day.ymd,
        processedConversations: conversations.length,
        analyzedConversations: analyzed.length,
        skippedUnchanged,
        sellers: sellers.length,
        clientsWaiting: sellers.reduce((a, s) => a + s.clientsWaiting, 0),
        severeFollowUpFailures: followUps.filter(x => x.severe).length,
        hunterManagements: hunterRows.length,
        identityDirectorySize: this.identities.snapshot().length,
        nextConversationCursor: cursor ? cursor.toISOString() : previous
      };

      await this.store.finishRun(runId, summary);
      return { ...summary, sellerMetrics: sellers };
    } catch (error) {
      await this.store.failRun(runId, error);
      throw error;
    }
  }
}

module.exports = { SupervisorEngine };
