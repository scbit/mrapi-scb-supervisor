const {minutesBetween,asDate}=require('./time');const {stableFingerprint}=require('./incremental');const {normalizeDirection}=require('./normalizers');

function latestDate(values){return values.map(asDate).filter(Boolean).sort((a,b)=>b-a)[0]||null}
function getConversationUnreadMeta(c={}){
  const explicitHasUnread=typeof c.hasUnread==='boolean'?c.hasUnread:null;
  const explicitUnreadCount=(c.unreadCount===null||c.unreadCount===undefined)?0:Math.max(0,Number(c.unreadCount)||0);
  const inbound=latestDate([c.lastInboundAt,c.lastCustomerMessageAt]);
  const outbound=latestDate([c.lastOutboundAt,c.lastHumanMessageAt]);
  const lastMessage=latestDate([c.lastMessageAt,c.sourceUpdatedAt,c.createdAt]);
  const manualRead=latestDate([c.manualReadAt]);
  const direction=normalizeDirection(c.lastMessageDirection);
  const fallbackUnread=!!(inbound&&(!outbound||inbound>outbound))||!!(direction==='inbound'&&inbound&&(!outbound||inbound>=outbound));
  const computed=explicitHasUnread!==null?explicitHasUnread:(explicitUnreadCount>0?true:fallbackUnread);
  const manuallyReadCurrentInbound=!!(manualRead&&(!inbound||inbound<=manualRead));
  const isUnread=computed&&!manuallyReadCurrentInbound;
  const available=explicitHasUnread!==null||c.unreadCount!==null&&c.unreadCount!==undefined||!!inbound||!!outbound||!!direction||!!manualRead;
  return{
    available,
    isUnread,
    unreadCount:isUnread?Math.max(explicitUnreadCount,1):0,
    unreadSince:isUnread&&inbound?inbound.toISOString():null,
    lastInboundAt:inbound?inbound.toISOString():null,
    lastOutboundAt:outbound?outbound.toISOString():null,
    lastMessageAt:lastMessage?lastMessage.toISOString():null,
    manualReadAt:manualRead?manualRead.toISOString():null
  }
}

// CORE semantics: "Nuevo / Sin asignar" means there is no CRM deal linked yet.
function assignmentState(c={}){const hasDeal=!!String(c.dealId||'').trim();return{pendingAssignment:!hasDeal,assignmentState:hasDeal?'assigned':'pending_assignment',assignmentReason:hasDeal?'has_deal':'no_deal'}}

function applyOperationalConversationState(metrics={},c={},now=new Date()){
  const unread=getConversationUnreadMeta(c);
  const assignment=assignmentState(c);
  let waitingForHuman=metrics.waitingForHuman===true;
  let waitingSince=metrics.waitingSince||null;
  let waitingMinutes=metrics.waitingMinutes??null;
  if(unread.available){
    waitingForHuman=unread.isUnread;
    waitingSince=unread.isUnread?unread.unreadSince:null;
    waitingMinutes=waitingSince?Math.max(0,minutesBetween(waitingSince,now)||0):null;
  }
  return{
    ...metrics,
    dealId:c.dealId||metrics.dealId||null,
    owner:c.owner||metrics.owner||null,
    stage:c.stage||metrics.stage||null,
    pendingAssignment:assignment.pendingAssignment,
    assignmentState:assignment.assignmentState,
    assignmentReason:assignment.assignmentReason,
    pendingAssignmentSince:assignment.pendingAssignment?(metrics.pendingAssignmentSince||unread.lastInboundAt||c.lastMessageAt||null):null,
    pendingAssignmentMinutes:assignment.pendingAssignment?(Math.max(0,minutesBetween(metrics.pendingAssignmentSince||unread.lastInboundAt||c.lastMessageAt,now)||0)):null,
    waitingForHuman,
    waitingSince,
    waitingMinutes,
    unreadCount:unread.unreadCount,
    operationalUnread:unread.isUnread,
    operationalUnreadSource:unread.available?'bandeja_metadata':'messages_fallback',
    manualReadAt:unread.manualReadAt,
    lastInboundAt:unread.lastInboundAt||metrics.lastInboundAt||null,
    lastOutboundAt:unread.lastOutboundAt||metrics.lastOutboundAt||null
  }
}

function analyzeConversation(c,msgs,{lateAfterMinutes=15,now=new Date()}={}){
  const ev=(msgs||[]).filter(m=>m.timestamp).sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp));let pending=null;const rt=[];
  for(const e of ev){if((e.actor==='client'||e.direction==='inbound')&&!pending)pending=e;if(e.actor==='human'&&pending){const n=minutesBetween(pending.timestamp,e.timestamp);if(n!==null&&n>=0)rt.push(n);pending=null}}
  const human=ev.filter(x=>x.actor==='human'),inbound=ev.filter(x=>x.actor==='client'||x.direction==='inbound');
  const base={conversationId:c.id,contactId:c.contactId,dealId:c.dealId,contactName:c.contactName||c.phone||'sin dato',phone:c.phone,owner:c.owner,stage:c.stage,sourceChannel:c.sourceChannel,sourceOrigin:c.sourceOrigin,adId:c.adId,adTitle:c.adTitle,adLine:c.adLine,pendingAssignment:false,pendingAssignmentSince:null,pendingAssignmentMinutes:null,waitingForHuman:!!pending,waitingSince:pending?.timestamp||null,waitingMinutes:pending?Math.max(0,minutesBetween(pending.timestamp,now)||0):null,waitingCustomerText:pending?.text||c.lastMessagePreview||null,inboundCount:inbound.length,humanOutboundCount:human.length,responseMinutes:rt,avgResponseMinutes:rt.length?Math.round(rt.reduce((a,b)=>a+b,0)/rt.length):null,p95ResponseMinutes:rt.length?[...rt].sort((a,b)=>a-b)[Math.ceil(rt.length*.95)-1]:null,lastSellerActivityAt:human.length?human.at(-1).timestamp:null,lastMessageAt:ev.at(-1)?.timestamp||c.lastMessageAt};
  return applyOperationalConversationState(base,c,now)
}
function messageFingerprint(c,m){return stableFingerprint({id:c.id,lastMessageAt:c.lastMessageAt,sourceUpdatedAt:c.sourceUpdatedAt,owner:c.owner,dealId:c.dealId,adId:c.adId,hasUnread:c.hasUnread,unreadCount:c.unreadCount,lastCustomerMessageAt:c.lastCustomerMessageAt,lastHumanMessageAt:c.lastHumanMessageAt,lastMessageDirection:c.lastMessageDirection,manualReadAt:c.manualReadAt,m:(m||[]).map(x=>[x.id,x.timestamp,x.actor])})}
module.exports={assignmentState,getConversationUnreadMeta,applyOperationalConversationState,analyzeConversation,messageFingerprint};
