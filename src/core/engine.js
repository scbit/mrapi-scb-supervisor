const crypto = require('crypto');
const { analyzeConversation, messageFingerprint, sanitizeWaitingMetric } = require('./conversationMetrics');
const { evaluateSevereFollowUp } = require('./followUp');
const { aggregateSeller } = require('./aggregate');
const { SellerIdentityResolver } = require('./sellerIdentity');
const { localDayRange, localDateParts, asDate } = require('./time');
const { cursorWithLookback, advanceCursor, stableFingerprint } = require('./incremental');
const { buildRunDiagnostics } = require('./runDiagnostics');

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
    const human = [...(messages || [])].reverse().find(m => m.actor === 'human' && m.user);
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

    return this.identities.resolve('unknown');
  }

  async resolveDerivedStateSeller(state, cache = new Map()) {
    const metrics = state?.metrics || {};
    const current = metrics.seller || state?.seller || null;
    if (current?.id && current.id !== 'unknown') return current;

    if (metrics.dealId) {
      const key = `deal:${metrics.dealId}`;
      if (!cache.has(key)) cache.set(key, await this.crm.getDeal(metrics.dealId));
      const deal = cache.get(key);
      if (deal?.owner) return this.identities.resolve(deal.owner);
    }

    if (metrics.contactId) {
      const key = `contact:${metrics.contactId}`;
      if (!cache.has(key)) cache.set(key, await this.crm.getContact(metrics.contactId));
      const contact = cache.get(key);
      if (contact?.owner) return this.identities.resolve(contact.owner);
    }

    if (metrics.phone) {
      const key = `phone:${metrics.phone}`;
      if (!cache.has(key)) cache.set(key, await this.crm.findContactByPhone(metrics.phone));
      const contact = cache.get(key);
      if (contact?.owner) return this.identities.resolve(contact.owner);
    }

    return this.identities.resolve('unknown');
  }

  async run({ now = new Date(), forceSince = null } = {}) {
    const runId = crypto.randomUUID();
    const runStartedMs = Date.now();
    const cfg = this.config;
    const lookbackMinutes = Number(cfg.incremental.lookback_minutes || 120);
    const bootstrapHours = Number(cfg.incremental.bootstrap_hours || 24);
    const checkpoints = await this.store.getSourceCheckpoints();

    const inboxCursor = forceSince || checkpoints.inbox?.cursor || null;
    const crmCursor = forceSince || checkpoints.crm?.cursor || null;
    const hunterCursor = forceSince || checkpoints.hunter?.cursor || null;
    const inboxSince = cursorWithLookback(inboxCursor, lookbackMinutes, now, bootstrapHours);
    const crmSince = cursorWithLookback(crmCursor, lookbackMinutes, now, bootstrapHours);
    const day = localDayRange(now, cfg.timezone);
    const hunterSinceCandidate = cursorWithLookback(hunterCursor, lookbackMinutes, now, bootstrapHours);
    const hunterSince = hunterSinceCandidate < day.start ? day.start : hunterSinceCandidate;

    await this.store.startRun(runId, {
      mode: 'incremental_v2',
      sourceCheckpoints: { inbox: inboxCursor, crm: crmCursor, hunter: hunterCursor },
      sourceSince: {
        inbox: inboxSince.toISOString(),
        crm: crmSince.toISOString(),
        hunter: hunterSince.toISOString()
      }
    });

    try {
      const [crmUsers, hunterUsers] = await Promise.all([
        this.crm.listUsers().catch(() => []),
        this.hunter.listUsers().catch(() => [])
      ]);
      for (const user of crmUsers) this.identities.registerCrmUser(user);
      for (const user of hunterUsers) this.identities.registerHunterUser(user);
      const rosterExclude = new Set(
        (cfg.seller_roster?.exclude_emails || []).map(x => String(x || '').trim().toLowerCase()).filter(Boolean)
      );
      const crmSellerUsers = crmUsers.filter(user => {
        const email = String(user.email || '').trim().toLowerCase();
        return !email || !rosterExclude.has(email);
      });

      // INBOX: changed conversations + fingerprint deduplication.
      const inboxStartedMs = Date.now();
      const conversations = await this.inbox.listChangedConversations({
        since: inboxSince,
        limit: cfg.incremental.max_conversations_per_run
      });
      const analyzed = [];
      const sellerCache = new Map();
      let skippedUnchanged = 0;
      for (const conversation of conversations) {
        const messages = await this.inbox.getMessages(conversation.id, cfg.incremental.max_messages_per_conversation);
        const fingerprint = messageFingerprint(conversation, messages);
        const previousState = await this.store.getConversationState(conversation.id);
        if (previousState?.fingerprint === fingerprint) {
          skippedUnchanged += 1;
          if (previousState.metrics) {
            const cleaned = sanitizeWaitingMetric(previousState.metrics, cfg.response.terminal_courtesy_phrases || []);
            analyzed.push(cleaned);
            const activityDay = previousState.activityDay || localDateParts(
              cleaned.lastMessageAt || conversation.lastMessageAt || now,
              cfg.timezone
            ).ymd;
            await this.store.saveConversationState(conversation.id, {
              activityDay,
              sellerId: cleaned.seller?.id || previousState.seller?.id || null,
              currentWaiting: cleaned.waitingForHuman === true,
              metrics: cleaned
            });
          }
          continue;
        }
        const seller = await this.resolveConversationSeller(conversation, messages, sellerCache);
        const metrics = analyzeConversation(conversation, messages, {
          lateAfterMinutes: cfg.response.late_after_minutes,
          terminalCourtesyPhrases: cfg.response.terminal_courtesy_phrases || [],
          pendingAssignmentStages: cfg.assignment?.pending_stages || [],
          pendingAssignmentIfNoOwner: cfg.assignment?.pending_if_no_owner !== false,
          now
        });
        metrics.seller = seller;
        const activityDay = localDateParts(metrics.lastMessageAt || conversation.lastMessageAt || now, cfg.timezone).ymd;
        await this.store.saveConversationState(conversation.id, {
          fingerprint,
          sourceLastMessageAt: conversation.lastMessageAt,
          activityDay,
          seller,
          sellerId: seller.id,
          currentWaiting: metrics.waitingForHuman === true,
          metrics
        });
        analyzed.push(metrics);
      }
      const nextInboxCursor = advanceCursor(inboxCursor, conversations.map(x => x.lastMessageAt));
      if (nextInboxCursor) await this.store.saveCheckpoint({ cursor: nextInboxCursor, lastRunId: runId }, 'inbox');
      const inboxDurationMs = Date.now() - inboxStartedMs;

      // CRM: bounded bootstrap pages are persisted by document id.
      // No repeated 1,500-deal bootstrap and no source-chat full scan.
      const crmStartedMs = Date.now();
      const crmBootstrapId = 'crm_bootstrap_v2';
      const crmBootstrap = await this.store.getCheckpoint(crmBootstrapId);
      const crmBootstrapComplete = crmBootstrap?.complete === true;
      let crmBootstrapPage = null;
      let deals = [];
      let crmMode = 'incremental';

      if (!crmBootstrapComplete) {
        crmMode = 'bootstrap';
        crmBootstrapPage = await this.crm.listBootstrapDeals({
          afterId: crmBootstrap?.afterId || null,
          limit: cfg.incremental.max_deals_per_run
        });
        deals = crmBootstrapPage.deals;
      } else {
        deals = await this.crm.listChangedDeals({
          since: crmSince,
          limit: cfg.incremental.max_deals_per_run
        });
      }

      const changedFollowUps = [];
      let skippedDeals = 0;
      let crmEnrichedDeals = 0;
      for (const dealRaw of deals) {
        const preliminary = evaluateSevereFollowUp(dealRaw, cfg, now);
        let deal = dealRaw;
        let evaluation = preliminary;
        if (preliminary.severe) {
          deal = await this.crm.enrichDealContact(dealRaw);
          evaluation = evaluateSevereFollowUp(deal, cfg, now);
          crmEnrichedDeals += 1;
        }
        const fingerprint = stableFingerprint({
          stage: deal.stageNorm,
          dueDate: deal.dueDate,
          owner: deal.owner,
          lastContactAt: deal.lastContactAt,
          lastRecontactAt: deal.lastRecontactAt,
          updatedAt: deal.updatedAt,
          severe: evaluation.severe,
          reason: evaluation.reason
        });
        const previousState = await this.store.getDealState(deal.id);
        if (previousState?.fingerprint === fingerprint) {
          skippedDeals += 1;
          continue;
        }
        await this.store.saveDealState(deal.id, { fingerprint, sourceUpdatedAt: deal.updatedAt, evaluation });
        changedFollowUps.push(evaluation);
      }
      if (changedFollowUps.length) await this.store.replaceFollowUpFailures(changedFollowUps, runId);

      let nextCrmCursor = crmCursor;
      let crmBootstrapRemaining = false;
      if (crmMode === 'bootstrap') {
        const firstStartedAt = crmBootstrap?.startedAt || now.toISOString();
        const complete = deals.length < Number(cfg.incremental.max_deals_per_run);
        crmBootstrapRemaining = !complete;
        await this.store.saveCheckpoint({
          startedAt: firstStartedAt,
          afterId: crmBootstrapPage?.lastDocId || crmBootstrap?.afterId || null,
          complete,
          lastRunId: runId,
          pageSize: deals.length
        }, crmBootstrapId);

        if (complete) {
          nextCrmCursor = firstStartedAt;
          await this.store.saveCheckpoint({ cursor: nextCrmCursor, lastRunId: runId }, 'crm');
        }
      } else {
        nextCrmCursor = advanceCursor(crmCursor, deals.map(x => x.updatedAt));
        if (nextCrmCursor) await this.store.saveCheckpoint({ cursor: nextCrmCursor, lastRunId: runId }, 'crm');
      }

      const followUps = await this.store.listActiveFollowUpFailures();
      const crmDurationMs = Date.now() - crmStartedMs;

      // HUNTER: persist new/changed events, then aggregate the derived current-day state.
      const hunterStartedMs = Date.now();
      const hunterChanged = await this.hunter.listChangedEvents({
        since: hunterSince,
        until: now,
        limit: cfg.incremental.max_hunter_events_per_run
      });
      let skippedHunter = 0;
      for (const row of hunterChanged) {
        const fingerprint = stableFingerprint(row);
        const previousState = await this.store.getHunterEventState(row.id);
        if (previousState?.fingerprint === fingerprint) {
          skippedHunter += 1;
          continue;
        }
        await this.store.saveHunterEventState(row.id, {
          fingerprint,
          sourceCreatedAt: row.createdAt || null,
          sourceUpdatedAt: row.updatedAt || row.completedAt || row.createdAt || null,
          day: day.ymd,
          row
        });
      }
      const nextHunterCursor = advanceCursor(hunterCursor, hunterChanged.map(x => x.updatedAt || x.completedAt || x.createdAt));
      if (nextHunterCursor) await this.store.saveCheckpoint({ cursor: nextHunterCursor, lastRunId: runId }, 'hunter');
      const hunterPersisted = await this.store.listHunterEventsForDay(day.ymd, cfg.incremental.max_hunter_events_per_run * 2);
      const hunterRows = hunterPersisted.map(x => x.row).filter(Boolean);
      const hunterRaw = this.hunter.aggregateBySeller(hunterRows);
      const hunterDurationMs = Date.now() - hunterStartedMs;

      // One-time derived-state index migration. This scans only SUPERVISOR's own derived
      // conversation state (not the 20k source conversations) and makes current waits queryable
      // across day boundaries.
      const currentIndexCheckpoint = await this.store.getCheckpoint('conversation_current_index_v1');
      if (!currentIndexCheckpoint?.complete) {
        const legacyStates = await this.store.listConversationStates(Number(cfg.incremental.max_current_conversation_states || 5000));
        for (const state of legacyStates) {
          if (!state.metrics) continue;
          const cleaned = sanitizeWaitingMetric(state.metrics, cfg.response.terminal_courtesy_phrases || []);
          await this.store.saveConversationState(state.id, {
            sellerId: cleaned.seller?.id || state.seller?.id || null,
            currentWaiting: cleaned.waitingForHuman === true,
            metrics: cleaned
          });
        }
        await this.store.saveCheckpoint({
          complete: true,
          indexed: legacyStates.length,
          lastRunId: runId
        }, 'conversation_current_index_v1');
      }

      // Daily aggregation must use the complete persisted current-day state, not only the
      // conversations returned by this incremental window. Otherwise unchanged conversations
      // would disappear from the daily seller metrics on later runs.
      const persistedConversationStates = await this.store.listConversationStatesForDay(
        day.ymd,
        Math.max(Number(cfg.incremental.max_daily_conversation_states || 5000), conversations.length * 2)
      );
      const dailyConversationMetrics = persistedConversationStates
        .map(x => x.metrics)
        .filter(Boolean)
        .map(x => sanitizeWaitingMetric(x, cfg.response.terminal_courtesy_phrases || []));

      // Pending assignment is a valid operational queue, not an identity error.
      // Supervisor never auto-assigns these chats.
      const remappedUnassigned = 0;

      const currentWaitingStates = await this.store.listCurrentWaitingConversationStates(
        Number(cfg.incremental.max_current_conversation_states || 5000)
      );
      const currentWaitingMetrics = currentWaitingStates
        .map(x => x.metrics)
        .filter(Boolean)
        .map(x => sanitizeWaitingMetric(x, cfg.response.terminal_courtesy_phrases || []))
        .filter(x => x.waitingForHuman);

      const dailyIds = new Set(dailyConversationMetrics.map(x => x.conversationId));
      const carriedWaits = currentWaitingMetrics
        .filter(x => !dailyIds.has(x.conversationId))
        .map(x => ({
          ...x,
          carriedWaitingOnly: true,
          inboundCount: 0,
          humanOutboundCount: 0,
          outboundCount: 0,
          botOutboundCount: 0,
          responsesCount: 0,
          responseMinutesTotal: 0,
          responseMinutes: [],
          lateCount: 0,
          lateResponses: [],
          lastSellerActivityAt: null
        }));

      const convBySeller = new Map();
      for (const row of [...dailyConversationMetrics, ...carriedWaits]) {
        if (row.pendingAssignment === true) continue;
        const seller = row.seller || this.identities.resolve(row.owner || 'unknown');
        if (seller.id === 'unknown') continue;
        if (!convBySeller.has(seller.id)) convBySeller.set(seller.id, { seller, rows: [] });
        convBySeller.get(seller.id).rows.push(row);
      }

      const hunterBySeller = new Map();
      for (const h of hunterRaw) {
        const seller = this.identities.resolve(h.rawSellerId, h.rawSellerName);
        hunterBySeller.set(seller.id, { seller, metrics: h });
      }

      const followBySeller = new Map();
      for (const f of followUps.filter(x => x.severe !== false && x.active !== false)) {
        const seller = this.identities.resolve(f.seller || 'unknown');
        if (!followBySeller.has(seller.id)) followBySeller.set(seller.id, { seller, rows: [] });
        followBySeller.get(seller.id).rows.push(f);
      }

      const crmSellerDirectory = crmSellerUsers.map(user => this.identities.resolve(user.email, user.id, user.name));
      const sellerIds = new Set([
        ...crmSellerDirectory.map(x => x.id),
        ...convBySeller.keys(),
        ...hunterBySeller.keys(),
        ...followBySeller.keys()
      ]);
      const sellers = [];
      for (const id of sellerIds) {
        const seller = crmSellerDirectory.find(x => x.id === id)
          || convBySeller.get(id)?.seller
          || hunterBySeller.get(id)?.seller
          || followBySeller.get(id)?.seller
          || this.identities.resolve(id);
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
      await this.store.saveCheckpoint({
        schemaVersion: cfg.incremental.checkpoint_schema_version || 1,
        lastRunId: runId,
        sources: { inbox: nextInboxCursor, crm: nextCrmCursor, hunter: nextHunterCursor }
      }, 'core');

      const diagnostics = buildRunDiagnostics({
        counts: {
          inbox: conversations.length,
          crm: crmMode === 'bootstrap' ? 0 : deals.length,
          hunter: hunterChanged.length,
          dailyState: persistedConversationStates.length
        },
        limits: {
          inbox: Number(cfg.incremental.max_conversations_per_run),
          crm: Number(cfg.incremental.max_deals_per_run),
          hunter: Number(cfg.incremental.max_hunter_events_per_run),
          dailyState: Number(cfg.incremental.max_daily_conversation_states || 5000)
        },
        skipped: {
          inboxUnchanged: skippedUnchanged,
          crmUnchanged: skippedDeals,
          hunterUnchanged: skippedHunter
        },
        durationsMs: {
          inbox: inboxDurationMs,
          crm: crmDurationMs,
          hunter: hunterDurationMs,
          total: Date.now() - runStartedMs
        }
      });
      if (crmMode === 'bootstrap' && crmBootstrapRemaining) {
        diagnostics.warnings.push('CRM_BOOTSTRAP_IN_PROGRESS');
      }

      const summary = {
        runId,
        date: day.ymd,
        processedConversations: conversations.length,
        analyzedConversations: analyzed.length,
        persistedConversationsToday: dailyConversationMetrics.length,
        currentWaitingConversations: currentWaitingMetrics.length,
        pendingAssignmentConversations: currentWaitingMetrics.filter(x => x.pendingAssignment === true).length,
        unassignedWaitingConversations: currentWaitingMetrics.filter(x => (x.seller?.id || 'unknown') === 'unknown' && x.pendingAssignment !== true).length,
        remappedUnassigned,
        crmMode,
        crmBootstrapRemaining,
        crmBootstrapAfterId: crmBootstrapPage?.lastDocId || crmBootstrap?.afterId || null,
        crmEnrichedDeals,
        skippedUnchanged,
        processedDeals: deals.length,
        changedDealEvaluations: changedFollowUps.length,
        skippedDeals,
        processedHunterEvents: hunterChanged.length,
        skippedHunter,
        persistedHunterEventsToday: hunterRows.length,
        sellers: sellers.length,
        clientsWaiting: sellers.reduce((a, s) => a + s.clientsWaiting, 0),
        severeFollowUpFailures: followUps.filter(x => x.severe !== false && x.active !== false).length,
        hunterEventsToday: hunterRows.length,
        hunterManagements: hunterRows.filter(x => x.eventType !== 'task_state').length,
        identityDirectorySize: this.identities.snapshot().length,
        sourceCursors: { inbox: nextInboxCursor, crm: nextCrmCursor, hunter: nextHunterCursor },
        diagnostics
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
