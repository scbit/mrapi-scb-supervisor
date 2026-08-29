const crypto = require("crypto");
const { asDate, minutesBetween } = require("./time");

function normalizeCourtesyText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!¡?¿.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTerminalCourtesy(value, phrases = []) {
  const normalized = normalizeCourtesyText(value);
  if (!normalized) return false;
  const configured = new Set((phrases || []).map(normalizeCourtesyText).filter(Boolean));
  return configured.has(normalized);
}

function sanitizeWaitingMetric(metrics, phrases = []) {
  if (!metrics || !metrics.waitingForHuman) return metrics;
  if (!isTerminalCourtesy(metrics.waitingCustomerText, phrases)) return metrics;
  return {
    ...metrics,
    waitingForHuman: false,
    waitingSince: null,
    waitingMinutes: null,
    waitingClosedByRule: "terminal_courtesy"
  };
}


function assignmentState(conversation = {}, options = {}) {
  const pendingStages = new Set(
    (options.pendingAssignmentStages || [])
      .map(v => String(v || "").trim().toUpperCase())
      .filter(Boolean)
  );
  const stage = String(conversation.stage || "").trim().toUpperCase();
  const hasOwner = !!String(conversation.owner || "").trim();
  const hasDeal = !!String(conversation.dealId || "").trim();
  const pendingByStage = pendingStages.has(stage);
  const pendingByNoOwner = options.pendingAssignmentIfNoOwner !== false && !hasOwner && !hasDeal;
  const pending = pendingByStage || pendingByNoOwner;
  return {
    pendingAssignment: pending,
    assignmentState: pending ? "pending_assignment" : "assigned",
    assignmentReason: pendingByStage ? "pending_stage" : (pendingByNoOwner ? "no_owner_no_deal" : "assigned")
  };
}


function messageFingerprint(conversation, messages) {
  const payload = {
    conversationId: conversation.id,
    lastMessageAt: conversation.lastMessageAt || null,
    owner: conversation.owner || null,
    dealId: conversation.dealId || null,
    contactId: conversation.contactId || null,
    messages: (messages || []).map(m => [m.id, m.timestamp, m.direction, m.actor, m.user])
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function analyzeConversation(conversation, messages, options = {}) {
  const lateAfterMinutes = Number(options.lateAfterMinutes ?? 15);
  const now = asDate(options.now) || new Date();
  const events = (messages || [])
    .filter(m => m.timestamp)
    .slice()
    .sort((a, b) => asDate(a.timestamp) - asDate(b.timestamp));

  const humanOutbound = events.filter(m => m.actor === "human");
  const inbound = events.filter(m => m.actor === "client" || m.direction === "inbound");
  const responseTimes = [];
  const lateResponses = [];
  let waitingSince = null;
  let waitingMessage = null;
  let pendingInbound = null;

  // A burst of customer messages opens one wait period. Only a human reply closes it.
  // Bot/automation messages intentionally do not count as seller responses.
  for (const event of events) {
    const isInbound = event.actor === "client" || event.direction === "inbound";
    const isHuman = event.actor === "human";
    if (isInbound && !pendingInbound) pendingInbound = event;
    if (isHuman && pendingInbound) {
      const mins = minutesBetween(pendingInbound.timestamp, event.timestamp);
      if (mins !== null && mins >= 0) {
        responseTimes.push(mins);
        if (mins > lateAfterMinutes) {
          lateResponses.push({
            inboundAt: pendingInbound.timestamp,
            outboundAt: event.timestamp,
            minutes: mins,
            customerText: String(pendingInbound.text || "").slice(0, 240),
            responseText: String(event.text || "").slice(0, 240)
          });
        }
      }
      pendingInbound = null;
    }
  }

  if (pendingInbound) {
    waitingSince = pendingInbound.timestamp;
    waitingMessage = pendingInbound;
  }

  if (pendingInbound && isTerminalCourtesy(pendingInbound.text, options.terminalCourtesyPhrases || [])) {
    waitingSince = null;
    waitingMessage = null;
    pendingInbound = null;
  }

  const last = events.at(-1) || null;
  const firstInbound = events.find(e => e.actor === "client") || null;
  const assignment = assignmentState(conversation, options);
  const lastInbound = [...inbound].reverse()[0] || null;
  const lastHuman = [...humanOutbound].reverse()[0] || null;
  const responseMinutesTotal = responseTimes.reduce((sum, n) => sum + n, 0);
  const avgResponseMinutes = responseTimes.length ? Math.round(responseMinutesTotal / responseTimes.length) : null;
  const maxResponseMinutes = responseTimes.length ? Math.max(...responseTimes) : null;
  const waitingMinutes = waitingSince ? Math.max(0, minutesBetween(waitingSince, now)) : null;

  const sellerActivityCandidates = humanOutbound.map(m => m.timestamp).filter(Boolean);
  if (conversation.lastOutboundAt) sellerActivityCandidates.push(conversation.lastOutboundAt);
  const lastSellerActivityAt = sellerActivityCandidates
    .map(asDate).filter(Boolean).sort((a, b) => b - a)[0] || null;

  return {
    conversationId: conversation.id,
    contactId: conversation.contactId || null,
    dealId: conversation.dealId || null,
    firstInboundText: firstInbound?.text || null,
    firstInboundAt: firstInbound?.timestamp || null,
    sourceChannel: conversation.sourceChannel || conversation.leadPlatform || null,
    sourceOrigin: conversation.sourceOrigin || null,
    adTitle: conversation.adTitle || null,
    adText: conversation.adText || null,
    adId: conversation.adId || null,
    adLine: conversation.adLine || conversation.lineId || null,
    pendingAssignment: assignment.pendingAssignment,
    assignmentState: assignment.assignmentState,
    assignmentReason: assignment.assignmentReason,
    pendingAssignmentSince: assignment.pendingAssignment ? (firstInbound?.timestamp || conversation.lastMessageAt || null) : null,
    pendingAssignmentMinutes: assignment.pendingAssignment && (firstInbound?.timestamp || conversation.lastMessageAt)
      ? Math.max(0, Math.floor(minutesBetween(firstInbound?.timestamp || conversation.lastMessageAt, options.now || new Date())))
      : null,
    contactName: conversation.contactName || conversation.phone || "sin dato",
    phone: conversation.phone || null,
    owner: conversation.owner || null,
    stage: conversation.stage || null,
    sourceChannel: conversation.sourceChannel || conversation.leadPlatform || null,
    messagesCount: events.length,
    inboundCount: inbound.length,
    humanOutboundCount: humanOutbound.length,
    outboundCount: events.filter(m => m.direction === "outbound").length,
    botOutboundCount: events.filter(m => m.actor === "bot").length,
    responsesCount: responseTimes.length,
    responseMinutesTotal,
    responseMinutes: responseTimes,
    avgResponseMinutes,
    maxResponseMinutes,
    lateCount: lateResponses.length,
    lateResponses,
    waitingForHuman: !!pendingInbound,
    waitingSince,
    waitingMinutes,
    waitingCustomerText: waitingMessage ? String(waitingMessage.text || "").slice(0, 240) : null,
    lastMessageAt: last?.timestamp || conversation.lastMessageAt || null,
    lastDirection: last?.direction || null,
    lastInboundAt: lastInbound?.timestamp || conversation.lastInboundAt || null,
    lastHumanAt: lastHuman?.timestamp || null,
    lastSellerActivityAt: lastSellerActivityAt ? lastSellerActivityAt.toISOString() : null,
    lastCustomerText: lastInbound ? String(lastInbound.text || "").slice(0, 240) : null,
    lastSellerText: lastHuman ? String(lastHuman.text || "").slice(0, 240) : null
  };
}

module.exports = { analyzeConversation, messageFingerprint, isTerminalCourtesy, sanitizeWaitingMetric, assignmentState };
