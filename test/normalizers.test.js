const test = require("node:test");
const assert = require("node:assert/strict");
const { detectMessageActor, normalizeDeal } = require("../src/core/normalizers");

test("detects human outbound patterns inherited from legacy", () => {
  assert.equal(detectMessageActor({ direction: "OUT", type: "human" }), "human");
  assert.equal(detectMessageActor({ direction: "OUT", userEmail: "seller@example.com" }), "human");
  assert.equal(detectMessageActor({ direction: "IN" }), "client");
  assert.equal(detectMessageActor({ direction: "OUT", source: "automation" }), "bot");
});

test("normalizes common CRM deal aliases", () => {
  const deal = normalizeDeal("d1", {
    estado: "Seguimiento",
    fechaVencimiento: "2026-08-20T00:00:00.000Z",
    vendedor: "seller@example.com"
  });
  assert.equal(deal.stageNorm, "SEGUIMIENTO");
  assert.equal(deal.owner, "seller@example.com");
  assert.equal(deal.dueDate, "2026-08-20T00:00:00.000Z");
});
