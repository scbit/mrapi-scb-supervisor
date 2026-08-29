const test = require("node:test");
const assert = require("node:assert/strict");
const { isTerminalCourtesy, sanitizeWaitingMetric } = require("../src/core/conversationMetrics");
const { aggregateSeller } = require("../src/core/aggregate");

test("short courtesy closings do not remain waiting", () => {
  const phrases = ["gracias", "perfecto gracias"];
  assert.equal(isTerminalCourtesy("Gracias!", phrases), true);
  assert.equal(isTerminalCourtesy("Perfecto, gracias.", phrases), true);
  assert.equal(isTerminalCourtesy("Gracias, necesito otra cotización", phrases), false);

  const cleaned = sanitizeWaitingMetric({
    waitingForHuman: true,
    waitingSince: "2026-08-28T20:00:00.000Z",
    waitingMinutes: 60,
    waitingCustomerText: "Gracias"
  }, phrases);
  assert.equal(cleaned.waitingForHuman, false);
  assert.equal(cleaned.waitingSince, null);
});

test("carried waits affect current waiting but not today's activity counts", () => {
  const seller = { id: "seller@example.com", label: "Seller", source: "mapped" };
  const result = aggregateSeller({
    seller,
    conversations: [{
      conversationId: "old-wait",
      carriedWaitingOnly: true,
      waitingForHuman: true,
      waitingMinutes: 600,
      humanOutboundCount: 0,
      inboundCount: 0,
      responseMinutes: [],
      responsesCount: 0,
      responseMinutesTotal: 0,
      lateCount: 0
    }],
    config: { seller_activity: { active_within_minutes: 45 }, business_hours: { weekdays:[1,2,3,4,5], start:"09:00", end:"17:00" }, timezone:"America/Argentina/Buenos_Aires" },
    now: new Date("2026-08-29T12:00:00Z")
  });
  assert.equal(result.clientsWaiting, 1);
  assert.equal(result.conversationsTotal, 0);
  assert.equal(result.responsesSent, 0);
});
