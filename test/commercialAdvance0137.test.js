const test=require('node:test');
const assert=require('node:assert/strict');
const {applyAi}=require('../src/core/dailyGerencial');
const {metrics,rowCase}=require('../src/core/manualSupervision');

test('0.13.7 concrete commercial advance is well worked',()=>{
 const out=applyAi({conversationId:'1',contactName:'A',seller:'x',inboundCount:1,humanResponded:true,humanTexts:[{text:'Te cotizo'}]},
 {commercial_advance:true,commercial_advance_type:'QUOTE',commercial_advance_reason:'Llegó a cotizar',commercial_discovery_level:'bajo',overall_score:75});
 const m=metrics([out]); assert.equal(m.good,1); assert.equal(m.toCorrect,0);
});
test('0.13.7 late is separate from commercial quality',()=>{
 const out=applyAi({conversationId:'1',contactName:'A',seller:'x',inboundCount:1,humanResponded:true,lateCount:1,maxHumanResponseMinutes:73,humanTexts:[{text:'Avanzo'}]},
 {commercial_advance:true,commercial_advance_type:'NEXT_STEP',commercial_discovery_level:'medio',overall_score:80});
 const m=metrics([out]); assert.equal(m.good,1); assert.equal(m.late,1); assert.equal(m.toCorrect,0);
});
test('0.13.7 Hugo explicit product fallback',()=>{
 const c=rowCase({conversationId:'h',contactName:'Hugo',seller:'x',inboundCount:1,humanResponded:true,clientTexts:['Bn x ahí tenga q importar una casa prefabricada y un auto'],ai:{commercial_advance:false,product_defined:false}});
 assert.equal(c.product.defined,true); assert.match(c.product.name,/casa prefabricada/i); assert.match(c.product.name,/auto/i);
});
