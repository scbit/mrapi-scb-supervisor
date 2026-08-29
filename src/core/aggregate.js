const { asDate, minutesBetween, isWithinBusinessHours } = require("./time");

function latestIso(values) {
  const dates = values.map(asDate).filter(Boolean).sort((a, b) => b - a);
  return dates[0] ? dates[0].toISOString() : null;
}

function aggregateSeller({ seller, conversations = [], hunter = null, followUps = [], config, now = new Date() }) {
  const waits = conversations.filter(c => c.waitingForHuman);
  const responseValues = conversations
    .filter(c => Number.isFinite(c.avgResponseMinutes))
    .flatMap(c => Array.from({ length: Math.max(1, c.responsesCount || 1) }, () => c.avgResponseMinutes));
  const avgResponseMinutes = responseValues.length
    ? Math.round(responseValues.reduce((a, b) => a + b, 0) / responseValues.length)
    : null;

  const lastActivity = latestIso([
    ...conversations.map(c => c.lastSellerActivityAt),
    hunter?.lastActivityAt
  ]);

  const activeWindow = Number(config?.seller_activity?.active_within_minutes ?? 45);
  const minutesSinceActivity = lastActivity ? minutesBetween(lastActivity, now) : null;
  const insideHours = isWithinBusinessHours(now, config);
  const active = minutesSinceActivity !== null && minutesSinceActivity <= activeWindow;

  return {
    sellerId: seller.id,
    sellerLabel: seller.label,
    identitySource: seller.source,
    lastActivity,
    active,
    activityState: active ? "active" : "inactive",
    inactivityIsAlert: false,
    businessHoursNow: insideHours,
    conversationsAttended: conversations.filter(c => c.humanOutboundCount > 0).length,
    conversationsInProgress: conversations.filter(c => c.inboundCount > 0 && c.humanOutboundCount > 0 && !c.waitingForHuman).length,
    clientsWaiting: waits.length,
    maxWaitingMinutes: waits.length ? Math.max(...waits.map(x => x.waitingMinutes || 0)) : 0,
    responsesSent: conversations.reduce((sum, c) => sum + (c.humanOutboundCount || 0), 0),
    avgResponseMinutes,
    lateResponses: conversations.reduce((sum, c) => sum + (c.lateCount || 0), 0),
    hunter: hunter || {
      managements: 0,
      results: {},
      lastActivityAt: null
    },
    severeFollowUpFailures: followUps.filter(x => x.severe).length,
    severeFollowUpCases: followUps.filter(x => x.severe)
  };
}

module.exports = { aggregateSeller };
