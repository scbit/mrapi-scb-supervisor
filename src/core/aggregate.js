const { asDate, minutesBetween, isWithinBusinessHours } = require("./time");

function latestIso(values) {
  const dates = values.map(asDate).filter(Boolean).sort((a, b) => b - a);
  return dates[0] ? dates[0].toISOString() : null;
}

function percentile(values, p) {
  const xs = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!xs.length) return null;
  const idx = Math.min(xs.length - 1, Math.max(0, Math.ceil((p / 100) * xs.length) - 1));
  return xs[idx];
}

function aggregateSeller({ seller, conversations = [], hunter = null, followUps = [], config, now = new Date() }) {
  const waits = conversations.filter(c => c.waitingForHuman);
  const responseTimes = conversations.flatMap(c => Array.isArray(c.responseMinutes) ? c.responseMinutes : []);
  const fallbackTotal = conversations.reduce((sum, c) => sum + Number(c.responseMinutesTotal || 0), 0);
  const fallbackCount = conversations.reduce((sum, c) => sum + Number(c.responsesCount || 0), 0);
  const responseTotal = responseTimes.length ? responseTimes.reduce((a, b) => a + b, 0) : fallbackTotal;
  const responseCount = responseTimes.length || fallbackCount;
  const avgResponseMinutes = responseCount ? Math.round(responseTotal / responseCount) : null;

  const lastActivity = latestIso([
    ...conversations.map(c => c.lastSellerActivityAt),
    hunter?.lastActivityAt
  ]);

  const activeWindow = Number(config?.seller_activity?.active_within_minutes ?? 45);
  const minutesSinceActivity = lastActivity ? minutesBetween(lastActivity, now) : null;
  const insideHours = isWithinBusinessHours(now, config);
  const active = minutesSinceActivity !== null && minutesSinceActivity <= activeWindow;

  const waitingCases = waits
    .map(c => ({
      conversationId: c.conversationId,
      contactId: c.contactId || null,
      dealId: c.dealId || null,
      contactName: c.contactName,
      phone: c.phone || null,
      waitingSince: c.waitingSince,
      waitingMinutes: c.waitingMinutes,
      customerText: c.waitingCustomerText,
      sourceChannel: c.sourceChannel || null
    }))
    .sort((a, b) => Number(b.waitingMinutes || 0) - Number(a.waitingMinutes || 0));

  const severeCases = followUps.filter(x => x.severe && x.active !== false);
  return {
    sellerId: seller.id,
    sellerLabel: seller.label,
    identitySource: seller.source,
    lastActivity,
    minutesSinceActivity,
    active,
    activityState: active ? "active" : "inactive",
    inactivityIsAlert: false,
    businessHoursNow: insideHours,
    conversationsTotal: conversations.length,
    conversationsAttended: conversations.filter(c => c.humanOutboundCount > 0).length,
    conversationsInProgress: conversations.filter(c => c.inboundCount > 0 && c.humanOutboundCount > 0 && !c.waitingForHuman).length,
    clientsWaiting: waits.length,
    maxWaitingMinutes: waits.length ? Math.max(...waits.map(x => x.waitingMinutes || 0)) : 0,
    waitingCases,
    responsesSent: conversations.reduce((sum, c) => sum + (c.humanOutboundCount || 0), 0),
    responsesMeasured: responseCount,
    avgResponseMinutes,
    p95ResponseMinutes: percentile(responseTimes, 95),
    maxResponseMinutes: responseTimes.length ? Math.max(...responseTimes) : null,
    lateResponses: conversations.reduce((sum, c) => sum + (c.lateCount || 0), 0),
    hunter: hunter || {
      managements: 0,
      followUps: 0,
      taskCompletions: 0,
      taskReschedules: 0,
      results: {},
      lastActivityAt: null
    },
    severeFollowUpFailures: severeCases.length,
    severeFollowUpCases: severeCases
  };
}

module.exports = { aggregateSeller, percentile };
