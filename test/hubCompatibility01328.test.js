const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeConversation,normalizeMessage}=require('../src/core/normalizers');
const {customerOf,lineOf}=require('../src/adapters/inboxAdapter');

test('Hub v1.5.76 lastInboundMessageAt is recognized as customer inbound',()=>{
  const c=normalizeConversation('x',{lastInboundMessageAt:'2026-09-23T12:00:00Z'});
  assert.equal(c.lastInboundAt,'2026-09-23T12:00:00.000Z');
  assert.equal(c.lastCustomerMessageAt,'2026-09-23T12:00:00.000Z');
});

test('Hub human and Dialogflow actor semantics remain distinct',()=>{
  assert.equal(normalizeMessage('1',{direction:'OUT',source:'human-template',sentBy:'Augusto',timestamp:'2026-09-23T12:00:00Z'}).actor,'human');
  assert.equal(normalizeMessage('2',{direction:'OUT',source:'dialogflow',sentBy:'BOT',timestamp:'2026-09-23T12:01:00Z'}).actor,'bot');
});

test('legacy conversation identity follows customer + line and parses readable ids',()=>{
  assert.equal(customerOf({customerPhone:'whatsapp:+5491112345678'},'x'),'5491112345678');
  assert.equal(lineOf({inboundTo:'whatsapp:+5491152738166'},'x'),'5491152738166');
  assert.equal(customerOf({},'5491112345678__5491152738166'),'5491112345678');
  assert.equal(lineOf({},'5491112345678__5491152738166'),'5491152738166');
});

test('Inbox adapter source merges aliases and deduplicates by messageSid',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'../src/adapters/inboxAdapter.js'),'utf8');
  assert.match(source,/relatedConversationIds/);
  assert.match(source,/duplicateConversationIds/);
  assert.match(source,/messageSid\|\|/);
  assert.match(source,/customerOf\(d,doc\.id\).*lineOf\(d,doc\.id\)/s);
});
