const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeConversation } = require("../src/core/conversationMetrics");

test("bot response does not close customer wait; human response does", () => {
  const conversation = { id: "c1", contactName: "Cliente" };
  const messages = [
    { id: "1", actor: "client", direction: "inbound", timestamp: "2026-08-28T12:00:00.000Z", text: "Hola" },
    { id: "2", actor: "bot", direction: "outbound", timestamp: "2026-08-28T12:01:00.000Z", text: "Bot" },
    { id: "3", actor: "human", direction: "outbound", timestamp: "2026-08-28T12:10:00.000Z", text: "Respuesta" }
  ];
  const result = analyzeConversation(conversation, messages, { lateAfterMinutes: 15, now: new Date("2026-08-28T12:20:00Z") });
  assert.equal(result.waitingForHuman, false);
  assert.equal(result.avgResponseMinutes, 10);
  assert.equal(result.responsesCount, 1);
  assert.equal(result.lateCount, 0);
});

test("customer remains waiting after bot-only outbound", () => {
  const result = analyzeConversation({ id: "c2" }, [
    { id: "1", actor: "client", direction: "inbound", timestamp: "2026-08-28T12:00:00.000Z" },
    { id: "2", actor: "bot", direction: "outbound", timestamp: "2026-08-28T12:01:00.000Z" }
  ], { now: new Date("2026-08-28T12:30:00.000Z") });
  assert.equal(result.waitingForHuman, true);
  assert.equal(result.waitingMinutes, 30);
});

test("inbound burst counts as one wait period", () => {
  const result = analyzeConversation({ id: "c3" }, [
    { id: "1", actor: "client", direction: "inbound", timestamp: "2026-08-28T12:00:00.000Z" },
    { id: "2", actor: "client", direction: "inbound", timestamp: "2026-08-28T12:02:00.000Z" },
    { id: "3", actor: "human", direction: "outbound", timestamp: "2026-08-28T12:05:00.000Z" }
  ], { now: new Date("2026-08-28T12:30:00.000Z") });
  assert.equal(result.responsesCount, 1);
  assert.equal(result.avgResponseMinutes, 5);
});
