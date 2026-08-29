const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const {normalizeConversation}=require('../src/core/normalizers');
const {getConversationUnreadMeta,applyOperationalConversationState,assignmentState}=require('../src/core/conversationMetrics');

test('Bandeja explicit hasUnread=false closes historical message wait',()=>{
  const c=normalizeConversation('c1',{
    dealId:'d1',hasUnread:false,unreadCount:0,lastMessageDirection:'OUT',
    lastCustomerMessageAt:'2026-05-01T12:00:00Z',lastHumanMessageAt:'2026-05-01T12:05:00Z',updatedAt:'2026-08-29T16:00:00Z'
  });
  const m=getConversationUnreadMeta(c);
  assert.equal(m.isUnread,false);
  const out=applyOperationalConversationState({waitingForHuman:true,waitingSince:'2026-05-01T12:00:00Z'},c,new Date('2026-08-29T17:00:00Z'));
  assert.equal(out.waitingForHuman,false);
  assert.equal(out.waitingMinutes,null);
});

test('manualReadAt after current inbound closes unread',()=>{
  const c=normalizeConversation('c2',{hasUnread:true,unreadCount:2,lastCustomerMessageAt:'2026-08-29T15:00:00Z',manualReadAt:'2026-08-29T15:10:00Z'});
  assert.equal(getConversationUnreadMeta(c).isUnread,false);
});

test('current explicit unread uses Bandeja inbound timestamp',()=>{
  const c=normalizeConversation('c3',{hasUnread:true,unreadCount:1,lastCustomerMessageAt:'2026-08-29T16:30:00Z',lastMessageDirection:'IN'});
  const out=applyOperationalConversationState({},c,new Date('2026-08-29T17:00:00Z'));
  assert.equal(out.waitingForHuman,true);
  assert.equal(out.waitingMinutes,30);
  assert.equal(out.operationalUnreadSource,'bandeja_metadata');
});

test('Nuevo Sin asignar follows CORE semantics: no deal',()=>{
  assert.equal(assignmentState({stage:'nuevo',dealId:null}).pendingAssignment,true);
  assert.equal(assignmentState({stage:'nuevo',dealId:'deal-1'}).pendingAssignment,false);
});

test('normalizer preserves operational Bandeja unread fields',()=>{
  const c=normalizeConversation('c4',{hasUnread:true,unreadCount:3,lastCustomerMessageAt:'2026-08-29T16:00:00Z',lastHumanMessageAt:'2026-08-29T15:00:00Z',lastMessageDirection:'IN',manualReadAt:null,updatedAt:'2026-08-29T16:01:00Z'});
  assert.equal(c.hasUnread,true);assert.equal(c.unreadCount,3);assert.equal(c.lastMessageDirection,'IN');assert.equal(c.sourceUpdatedAt,'2026-08-29T16:01:00.000Z');
});

test('Inbox incremental observes updatedAt so manual-read/CRM-link state changes are visible',()=>{
  const source=fs.readFileSync('src/adapters/inboxAdapter.js','utf8');
  assert.ok(source.includes("orderBy('updatedAt','asc')"));
});
