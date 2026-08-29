const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateSevereFollowUp } = require("../src/core/followUp");

const config = {
  follow_up: {
    severe_after_days: 7,
    active_stages: ["SEGUIMIENTO", "MARCA PERSONAL", "COTIZADO PARA ENVIAR", "HORNO"],
    inactive_stages: ["DESCARTADO", "PERDIDO"]
  }
};

test("severe failure requires 7+ overdue days, active stage and no recontact", () => {
  const result = evaluateSevereFollowUp({
    id: "d1",
    owner: "seller@example.com",
    stage: "SEGUIMIENTO",
    dueDate: "2026-08-20T12:00:00.000Z",
    updatedAt: "2026-08-20T12:00:00.000Z"
  }, config, new Date("2026-08-28T12:00:00.000Z"));
  assert.equal(result.severe, true);
  assert.equal(result.daysOverdue, 8);
});

test("inactive stage does not alert", () => {
  const result = evaluateSevereFollowUp({
    id: "d2",
    stage: "PERDIDO",
    dueDate: "2026-08-01T12:00:00.000Z"
  }, config, new Date("2026-08-28T12:00:00.000Z"));
  assert.equal(result.severe, false);
});

test("recontact after due prevents severe failure", () => {
  const result = evaluateSevereFollowUp({
    id: "d3",
    stage: "HORNO",
    dueDate: "2026-08-15T12:00:00.000Z",
    lastRecontactAt: "2026-08-20T12:00:00.000Z"
  }, config, new Date("2026-08-28T12:00:00.000Z"));
  assert.equal(result.severe, false);
  assert.equal(result.recontacted, true);
});
