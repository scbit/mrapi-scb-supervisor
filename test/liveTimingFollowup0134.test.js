const test=require('node:test');
const assert=require('node:assert/strict');
const {liveText,metrics}=require('../src/core/manualSupervision');

test('0.13.4 live report shows exact late duration and max delay',()=>{
 const row={conversationId:'1',contactName:'A',seller:'x',inboundCount:1,humanResponded:true,lateCount:1,maxHumanResponseMinutes:73,operationalWithoutDiscovery:true,ai:{product_defined:true,product_name:'Producto'}};
 const t=liveText({date:'2026-09-04',cutoff:17,label:'Augusto',rows:[row]});
 assert.ok(t.includes('Tarde: 1 · Máxima demora: 1h 13m'));
 assert.ok(t.includes('Respuesta: TARDE · 1h 13m'));
 assert.ok(!t.includes('Producto descubierto por'));
});
test('0.13.4 live report exposes correct follow-ups separately',()=>{
 const row={conversationId:'2',contactName:'Dormido',seller:'x',inboundCount:0,humanResponded:true,humanCount:1,followUpOk:true,followUpCorrect:true,sellerFollowUpInWindow:true,followUpAttemptsAfterLastClient:3,ai:{}};
 const t=liveText({date:'2026-09-04',cutoff:17,label:'Augusto',rows:[row]});
 assert.ok(t.includes('Seguimientos correctos: 1'));
 assert.ok(t.includes('TODOS LOS CHATS DEL DÍA'));
 assert.ok(t.includes('CORRECTO · 3 intentos'));
});
