const test=require('node:test');
const assert=require('node:assert/strict');
const {liveText,metrics}=require('../src/core/manualSupervision');
test('0.13.8 lists every visible chat exactly once',()=>{
 const rows=[
  {conversationId:'1',contactName:'Bueno',seller:'x',messagesInWindow:2,inboundCount:1,humanCount:1,humanResponded:true,commercialAdvance:true,ai:{commercial_advance:true,product_defined:true,product_name:'A'}},
  {conversationId:'2',contactName:'Malo',seller:'x',messagesInWindow:2,inboundCount:1,humanCount:1,humanResponded:true,ai:{commercial_advance:false,product_defined:true,product_name:'B'}},
  {conversationId:'3',contactName:'Follow',seller:'x',messagesInWindow:1,inboundCount:0,humanCount:1,humanResponded:true,sellerFollowUpInWindow:true,followUpAttemptsAfterLastClient:1,ai:{product_defined:true,product_name:'C'}}
 ];
 const t=liveText({date:'2026-09-04',cutoff:17,label:'Augusto',rows});
 assert.ok(t.includes('TODOS LOS CHATS DEL DÍA (3)'));
 assert.equal((t.match(/HUB:/g)||[]).length,3);
 assert.ok(t.includes('Bueno — BIEN TRABAJADO'));
 assert.ok(t.includes('Malo — PENDIENTE'));
 assert.ok(t.includes('Follow — REVISAR SEGUIMIENTO'));
 assert.ok(!t.includes('A TIEMPO · 0 min'));
});
test('0.13.8 visibleChats equals activity rows',()=>{
 const rows=[{conversationId:'1',messagesInWindow:1,inboundCount:1,humanCount:1,humanResponded:true,commercialAdvance:true,ai:{commercial_advance:true}},{conversationId:'2',messagesInWindow:1,inboundCount:0,humanCount:1,humanResponded:true,sellerFollowUpInWindow:true,ai:{}}];
 assert.equal(metrics(rows).visibleChats,2);
});
