const { toIso } = require("./time");

function text(obj, keys) {
  for (const key of keys) {
    const v = obj?.[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function numberValue(obj, keys) {
  for (const key of keys) {
    const n = Number(obj?.[key]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeStage(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function normalizeDirection(value) {
  const v = String(value || "").trim().toUpperCase();
  if (["IN", "INBOUND", "CLIENT", "CLIENTE"].includes(v)) return "inbound";
  if (["OUT", "OUTBOUND", "SELLER", "VENDEDOR", "BOT"].includes(v)) return "outbound";
  return v ? v.toLowerCase() : null;
}

function detectMessageActor(raw = {}) {
  const direction = normalizeDirection(raw.direction || raw.dir || raw.type || null);
  const joined = [
    raw.direction, raw.dir, raw.type, raw.source, raw.provider, raw.channel,
    raw.user, raw.userEmail, raw.owner, raw.agent, raw.sentBy,
    raw.profileName, raw.createdBy, raw.author, raw.role
  ].map(v => String(v || "").toLowerCase()).join(" ");

  if (direction === "inbound") return "client";

  const hasHumanUser = !!String(
    raw.user || raw.userEmail || raw.owner || raw.agent || raw.sentBy ||
    raw.profileName || raw.createdBy || raw.author || ""
  ).trim();

  if (direction === "outbound" && (
    joined.includes("human-template") ||
    joined.includes("human_template") ||
    joined.includes("manual-template") ||
    joined.includes("manual_template") ||
    joined.includes(" human ") ||
    joined.startsWith("human ") ||
    joined.endsWith(" human") ||
    joined.includes("out human") ||
    joined.includes("whatsapp human") ||
    (joined.includes("template") && hasHumanUser)
  )) return "human";

  if (
    joined.includes("bot") ||
    joined.includes("automation") ||
    joined.includes("automat") ||
    joined.includes("system") ||
    joined.includes("template") ||
    joined.includes("auto")
  ) return "bot";

  if (direction === "outbound" && hasHumanUser) return "human";
  if (direction === "outbound") return "outbound_unknown";
  if (joined.includes("system")) return "system";
  return "unknown";
}

function normalizeConversation(id, d = {}) {
  return {
    id,
    contactId: text(d, ["contactId", "contact_id"]) || null,
    contactName: text(d, ["contactName", "name", "customerName", "clientName"]) || null,
    dealId: text(d, ["dealId", "deal_id"]) || null,
    inboundTo: text(d, ["inboundTo"]) || null,
    lineId: text(d, ["lineId", "line", "whatsappLine"]) || null,
    phone: text(d, ["phone", "customerPhone", "clientPhone", "whatsapp"]) || null,
    stage: text(d, ["stage", "status"]) || null,
    mode: text(d, ["mode"]) || null,
    lastMessagePreview: text(d, ["lastMessagePreview", "lastMessage", "lastText"]) || null,
    lastMessageAt: toIso(d.lastMessageAt || d.updatedAt || d.createdAt),
    lastInboundAt: toIso(d.lastInboundAt),
    lastOutboundAt: toIso(d.lastOutboundAt),
    leadPlatform: text(d, ["leadPlatform"]) || null,
    sourceChannel: text(d, ["sourceChannel"]) || null,
    owner: text(d, ["owner", "ownerEmail", "assignedTo", "seller", "vendedor", "responsible"]) || null
  };
}

function normalizeMessage(id, d = {}) {
  const rawDirection = d.direction || d.dir || d.type || null;
  return {
    id,
    direction: normalizeDirection(rawDirection),
    actor: detectMessageActor(d),
    rawDirection,
    from: text(d, ["from"]) || null,
    to: text(d, ["to"]) || null,
    user: text(d, ["user", "userEmail", "owner", "agent", "sentBy", "profileName", "createdBy", "author"]) || null,
    text: text(d, ["text", "body", "message", "content", "caption", "fileName", "filename", "attachmentName"]),
    timestamp: toIso(d.timestamp || d.createdAt || d.date || d.sentAt),
    source: text(d, ["source", "provider", "channel"]) || null
  };
}

function normalizeDeal(id, d = {}) {
  const stage = text(d, ["stage", "status", "estado", "pipelineStage"]);
  const stageNorm = normalizeStage(stage);
  const closedStages = new Set([
    "PERDIDO", "DESCARTADO", "CLOSED", "WON", "LOST", "CERRADO",
    "GANADO", "GANADO COURIER", "GANADO MARITIMO", "GANADO MARÍTIMO"
  ]);
  return {
    id,
    title: text(d, ["title", "name", "dealName", "nombre"]) || id,
    contactId: text(d, ["contactId", "contact_id"]) || null,
    owner: text(d, ["owner", "ownerEmail", "assignedTo", "seller", "vendedor", "responsible"]) || null,
    stage,
    stageNorm,
    value: numberValue(d, ["value", "amount", "valor"]),
    dueDate: toIso(d.dueDate || d.nextDueDate || d.fechaVencimiento || d.vencimiento || d.nextFollowUpAt || d.followUpDate),
    notes: text(d, ["notes", "note", "lastNote"]) || null,
    conversationId: text(d, ["conversationId", "waConversationId", "chatId", "whatsappConversationId"]) || null,
    updatedAt: toIso(d.updatedAt || d.lastActivityAt || d.createdAt),
    createdAt: toIso(d.createdAt),
    lastContactAt: toIso(d.lastContactAt || d.lastContact || d.contactedAt || d.lastCustomerContactAt),
    lastRecontactAt: toIso(d.lastRecontactAt || d.recontactedAt || d.lastFollowUpAt || d.lastFollowupAt),
    isClosed: d.isClosed === true || d.closed === true || closedStages.has(stageNorm) || stageNorm.startsWith("GANADO ")
  };
}

function normalizeContact(id, d = {}) {
  return {
    id,
    name: text(d, ["name", "contactName", "clientName", "cliente"]) || id,
    company: text(d, ["company", "companyName", "empresa"]) || null,
    phone: text(d, ["phone", "whatsapp", "mobile", "phoneNumber", "waPhone"]) || null,
    email: text(d, ["email", "mail"]) || null,
    owner: text(d, ["owner", "ownerName", "ownerDisplayName", "ownerEmail", "assignedTo", "assignedToName", "seller", "sellerName", "vendedor", "responsible"]) || null,
    updatedAt: toIso(d.updatedAt || d.lastActivityAt || d.createdAt)
  };
}

module.exports = {
  text,
  normalizeStage,
  normalizeDirection,
  detectMessageActor,
  normalizeConversation,
  normalizeMessage,
  normalizeDeal,
  normalizeContact
};
