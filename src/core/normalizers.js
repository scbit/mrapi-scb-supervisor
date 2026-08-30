const {toIso}=require('./time');
function text(o,ks){for(const k of ks){const v=o?.[k];if(v!==undefined&&v!==null&&String(v).trim())return String(v).trim()}return''}
function normalizeStage(v){return String(v||'').trim().toUpperCase().replace(/\s+/g,' ')}
function normalizeDirection(v){const x=String(v||'').trim().toUpperCase();if(['IN','INBOUND','CLIENT','CLIENTE'].includes(x))return'inbound';if(['OUT','OUTBOUND','SELLER','VENDEDOR','BOT'].includes(x))return'outbound';return x?x.toLowerCase():null}
function detectMessageActor(r={}){const d=normalizeDirection(r.direction||r.dir||r.type||null);const j=[r.direction,r.dir,r.type,r.source,r.provider,r.channel,r.user,r.userEmail,r.owner,r.agent,r.sentBy,r.profileName,r.createdBy,r.author,r.role].map(v=>String(v||'').toLowerCase()).join(' ');if(d==='inbound')return'client';const hasHumanUser=!!String(r.user||r.userEmail||r.owner||r.agent||r.sentBy||r.profileName||r.createdBy||r.author||'').trim();if(d==='outbound'&&(j.includes('human-template')||j.includes('human_template')||j.includes('manual-template')||j.includes('manual_template')||j.includes(' human ')||j.startsWith('human ')||j.endsWith(' human')||j.includes('out human')||j.includes('whatsapp human')||(j.includes('template')&&hasHumanUser)))return'human';if(j.includes('bot')||j.includes('automation')||j.includes('automat')||j.includes('system')||j.includes('template')||j.includes('auto'))return'bot';if(d==='outbound'&&hasHumanUser)return'human';if(d==='outbound')return'outbound_unknown';if(j.includes('system'))return'system';return'unknown'}
function nullableNumber(v){if(v===undefined||v===null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function normalizeConversation(id,d={}){return{
  id,
  contactId:text(d,['contactId','contact_id'])||null,
  contactName:text(d,['contactName','name','customerName','clientName'])||null,
  dealId:text(d,['dealId','crmDealId','deal_id'])||null,
  phone:text(d,['phone','customerPhone','clientPhone','whatsapp','waFrom'])||null,
  stage:text(d,['stage','status'])||null,
  lastMessagePreview:text(d,['lastMessagePreview','lastMessage','lastText'])||null,
  lastMessageAt:toIso(d.lastMessageAt||d.updatedAt||d.createdAt),
  sourceUpdatedAt:toIso(d.updatedAt||d.lastMessageAt||d.createdAt),
  createdAt:toIso(d.createdAt),
  lastInboundAt:toIso(d.lastInboundAt),
  lastCustomerMessageAt:toIso(d.lastCustomerMessageAt||d.lastClientMessageAt||d.lastIncomingAt||d.lastReceivedAt),
  lastOutboundAt:toIso(d.lastOutboundAt),
  lastHumanMessageAt:toIso(d.lastHumanMessageAt||d.lastAgentMessageAt||d.lastUserMessageAt||d.lastReplyAt),
  lastMessageDirection:text(d,['lastMessageDirection','lastDirection','lastMsgDirection'])||null,
  hasUnread:typeof d.hasUnread==='boolean'?d.hasUnread:null,
  unreadCount:nullableNumber(d.unreadCount??d.unreadMessages??d.pendingUnreadCount),
  manualReadAt:toIso(d.manualReadAt||d.lastManualReadAt||d.readAt),
  sourceChannel:text(d,['sourceChannel','leadPlatform','channel'])||null,
  sourceOrigin:text(d,['referralSourceType','sourceOrigin','origin'])||null,
  adTitle:text(d,['referralHeadline','adTitle'])||null,
  adText:text(d,['referralBody','adText'])||null,
  adId:text(d,['referralAdId','adId','ad_id'])||null,
  adLine:text(d,['requestedLineId','adLine','lineId'])||null,
  owner:text(d,['owner','ownerEmail','assignedTo','seller','vendedor'])||null
}}
function normalizeMessage(id,d={}){const rd=d.direction||d.dir||d.type||null;return{id,direction:normalizeDirection(rd),actor:detectMessageActor(d),user:text(d,['user','userEmail','owner','agent','sentBy','profileName','createdBy','author'])||null,text:text(d,['text','body','message','content','caption']),timestamp:toIso(d.timestamp||d.createdAt||d.date||d.sentAt)}}
function normalizeLeadQuality(v){const x=String(v||'NO_RESPONDE').trim().toUpperCase().replace(/\s+/g,'_');if(['DESCARTADO','NO_RESPONDE','REGULAR','BUENO','EXCELENTE'].includes(x))return x;if(x==='NO_RESPUESTA')return'NO_RESPONDE';return'NO_RESPONDE'}
function normalizeDeal(id,d={}){const stage=text(d,['stage','status','estado','pipelineStage']);const stageNorm=normalizeStage(stage);const closed=['PERDIDO','DESCARTADO','CLOSED','WON','LOST','CERRADO','GANADO','GANADO COURIER','GANADO MARITIMO','GANADO MARÍTIMO'];return{id,title:text(d,['title','name','dealName','nombre'])||id,contactId:text(d,['contactId','contact_id'])||null,conversationId:text(d,['conversationId','waConversationId','chatId','whatsappConversationId'])||null,owner:text(d,['owner','ownerEmail','assignedTo','seller','vendedor','responsible'])||null,stage,stageNorm,leadQuality:normalizeLeadQuality(d.leadQuality||'NO_RESPONDE'),dueDate:toIso(d.dueDate||d.nextDueDate||d.fechaVencimiento||d.vencimiento||d.nextFollowUpAt||d.followUpDate),updatedAt:toIso(d.updatedAt||d.lastActivityAt||d.createdAt),createdAt:toIso(d.createdAt),lastContactAt:toIso(d.lastContactAt||d.lastContact||d.contactedAt),lastRecontactAt:toIso(d.lastRecontactAt||d.recontactedAt||d.lastFollowUpAt),isClosed:d.isClosed===true||d.closed===true||closed.includes(stageNorm)||stageNorm.startsWith('GANADO ')}}
module.exports={normalizeStage,normalizeDirection,normalizeConversation,normalizeMessage,normalizeDeal,normalizeLeadQuality,detectMessageActor};
