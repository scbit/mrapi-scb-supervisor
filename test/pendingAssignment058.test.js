const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeConversation, assignmentState } = require("../src/core/conversationMetrics");

test("Sin asignar is pending assignment", () => {
  const r = assignmentState(
    { stage: "Sin asignar", owner: null, dealId: null },
    { pendingAssignmentStages: ["NUEVO", "SIN ASIGNAR"], pendingAssignmentIfNoOwner: true }
  );
  assert.equal(r.pendingAssignment, true);
  assert.equal(r.assignmentState, "pending_assignment");
});

test("real owner/deal is assigned", () => {
  const r = assignmentState(
    { stage: "Seguimiento", owner: "seller@sentirecustomsbroker.com", dealId: "d1" },
    { pendingAssignmentStages: ["NUEVO", "SIN ASIGNAR"], pendingAssignmentIfNoOwner: true }
  );
  assert.equal(r.pendingAssignment, false);
});

test("first inbound and ad metadata survive derived analysis", () => {
  const result = analyzeConversation({
    id: "c1",
    stage: "Nuevo",
    sourceChannel: "meta_ad",
    sourceOrigin: "ad",
    adTitle: "Importa desde china seguro",
    adText: "Importar desde China...",
    adId: "120252025312030019",
    adLine: "5491152738166",
    owner: null,
    dealId: null,
    lastMessageAt: "2026-08-29T12:00:00.000Z"
  }, [{
    id: "m1",
    actor: "client",
    direction: "inbound",
    text: "Importar por marítimo, optimizar costos aduanito",
    timestamp: "2026-08-29T12:00:00.000Z"
  }], {
    lateAfterMinutes: 15,
    pendingAssignmentStages: ["NUEVO", "SIN ASIGNAR"],
    pendingAssignmentIfNoOwner: true,
    now: new Date("2026-08-29T12:10:00.000Z")
  });

  assert.equal(result.pendingAssignment, true);
  assert.equal(result.firstInboundText, "Importar por marítimo, optimizar costos aduanito");
  assert.equal(result.sourceChannel, "meta_ad");
  assert.equal(result.adId, "120252025312030019");
  assert.equal(result.pendingAssignmentMinutes, 10);
});
