const test = require("node:test");
const assert = require("node:assert/strict");
const { hasRecontactAfterDue, evaluateSevereFollowUp } = require("../src/core/followUp");

const config = { follow_up: { severe_after_days: 7, active_stages: ["SEGUIMIENTO"], inactive_stages: ["PERDIDO"] } };

test("generic updatedAt is not accepted as recontact evidence", () => {
  const deal = { id: "d1", stage: "SEGUIMIENTO", dueDate: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-20T00:00:00.000Z" };
  assert.equal(hasRecontactAfterDue(deal), false);
  assert.equal(evaluateSevereFollowUp(deal, config, new Date("2026-08-20T12:00:00Z")).severe, true);
});

test("explicit contact after due date suppresses severe failure", () => {
  const deal = { id: "d2", stage: "SEGUIMIENTO", dueDate: "2026-08-01T00:00:00.000Z", lastContactAt: "2026-08-15T00:00:00.000Z" };
  assert.equal(hasRecontactAfterDue(deal), true);
  assert.equal(evaluateSevereFollowUp(deal, config, new Date("2026-08-20T12:00:00Z")).severe, false);
});
