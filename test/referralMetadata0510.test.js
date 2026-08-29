const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeConversation } = require("../src/core/normalizers");
const { analyzeConversation } = require("../src/core/conversationMetrics");

test("real referral fields from Inbox conversation are mapped", () => {
  const c = normalizeConversation("+5491122538536__+5491139919733", {
    owner: "oficina.caba@sentirecustomsbroker.com",
    phone: "5491122538536",
    referralAdId: "120243929914440019",
    referralBody: "Fantastico",
    referralCtwaClid: "Afjz-example",
    referralHeadline: "Desachante de aduana",
    referralSourceType: "ad",
    requestedLineId: "5491139919733",
    sourceChannel: "meta_ad",
    stage: "nuevo"
  });

  assert.equal(c.sourceChannel, "meta_ad");
  assert.equal(c.sourceOrigin, "ad");
  assert.equal(c.adTitle, "Desachante de aduana");
  assert.equal(c.adText, "Fantastico");
  assert.equal(c.adId, "120243929914440019");
  assert.equal(c.adLine, "5491139919733");
  assert.equal(c.referralCtwaClid, "Afjz-example");
});

test("derived metrics preserve real referral metadata", () => {
  const c = normalizeConversation("c1", {
    referralAdId: "120243929914440019",
    referralBody: "Fantastico",
    referralHeadline: "Desachante de aduana",
    referralSourceType: "ad",
    requestedLineId: "5491139919733",
    sourceChannel: "meta_ad",
    stage: "nuevo"
  });

  const r = analyzeConversation(c, [{
    id: "m1",
    actor: "client",
    direction: "inbound",
    text: "Quiero importar",
    timestamp: "2026-08-29T12:00:00.000Z"
  }], {
    pendingAssignmentStages: ["NUEVO", "SIN ASIGNAR"],
    pendingAssignmentIfNoOwner: true,
    now: new Date("2026-08-29T12:05:00.000Z")
  });

  assert.equal(r.sourceOrigin, "ad");
  assert.equal(r.adTitle, "Desachante de aduana");
  assert.equal(r.adText, "Fantastico");
  assert.equal(r.adId, "120243929914440019");
  assert.equal(r.adLine, "5491139919733");
});
