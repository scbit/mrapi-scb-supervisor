const { daysOverdue, asDate } = require("./time");
const { normalizeStage } = require("./normalizers");

function hasRecontactAfterDue(deal) {
  const due = asDate(deal.dueDate);
  if (!due) return false;
  const candidates = [deal.lastRecontactAt, deal.lastContactAt, deal.updatedAt]
    .map(asDate)
    .filter(Boolean);
  return candidates.some(d => d.getTime() > due.getTime());
}

function evaluateSevereFollowUp(deal, config, asOf = new Date()) {
  const rules = config.follow_up || {};
  const threshold = Number(rules.severe_after_days ?? 7);
  const stage = normalizeStage(deal.stageNorm || deal.stage);
  const active = new Set((rules.active_stages || []).map(normalizeStage));
  const inactive = new Set((rules.inactive_stages || []).map(normalizeStage));
  const overdueDays = daysOverdue(deal.dueDate, asOf);

  const stageActive = active.has(stage);
  const stageInactive = inactive.has(stage) || deal.isClosed === true;
  const recontacted = hasRecontactAfterDue(deal);
  const severe = !stageInactive && stageActive && overdueDays !== null && overdueDays >= threshold && !recontacted;

  return {
    dealId: deal.id,
    seller: deal.owner || null,
    client: deal.contactName || deal.title || deal.contactId || null,
    contactId: deal.contactId || null,
    stage: deal.stage || null,
    stageNorm: stage,
    dueDate: deal.dueDate || null,
    daysOverdue: overdueDays,
    lastContact: deal.lastContactAt || null,
    lastActivity: deal.updatedAt || null,
    recontacted,
    severe,
    reason: severe
      ? `Trato vencido ${overdueDays} días, sin recontacto posterior al vencimiento y en etapa activa ${stage}.`
      : null
  };
}

module.exports = { hasRecontactAfterDue, evaluateSevereFollowUp };
