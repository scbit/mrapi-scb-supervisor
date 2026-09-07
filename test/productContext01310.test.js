const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const {rowCase}=require('../src/core/manualSupervision');

test('0.13.10 keeps explicit AI product name even if boolean is inconsistent',()=>{
 const c=rowCase({conversationId:'w',contactName:'walid',inboundCount:1,humanResponded:true,ai:{product_defined:false,product_name:'cortadora circular de carpintero de mano',commercial_advance:false}});
 assert.equal(c.product.defined,true);
 assert.equal(c.product.name,'cortadora circular de carpintero de mano');
});

test('0.13.10 product fallback can use bot/human explicit context',()=>{
 const c=rowCase({conversationId:'w',contactName:'walid',inboundCount:1,humanResponded:true,botTexts:['¿Necesitás una cortadora circular de carpintero de mano?'],humanTexts:[{text:'Podemos cotizar la cortadora circular de carpintero de mano por aéreo'}],ai:{product_defined:false,product_name:'',commercial_advance:false}});
 assert.equal(c.product.defined,true);
 assert.match(c.product.name,/cortadora circular/i);
});

test('0.13.10 AI prompt requires full conversation context for product',()=>{
 const s=fs.readFileSync('src/adapters/openaiAdapter.js','utf8');
 assert.ok(s.includes('CLIENTE + BOT + VENDEDOR HUMANO'));
 assert.ok(s.includes('cortadora circular de carpintero de mano'));
});
