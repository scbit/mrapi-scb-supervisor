const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const {closeCrmPortfolio,closeText}=require('../src/core/manualSupervision');

function deal(id,owner,stage,due,title='Cliente',conversationId=''){
 return {id,snapshot:{owner,stage,stageNorm:String(stage).toUpperCase(),dueDate:due,title,conversationId}};
}

test('0.13.15 CRM portfolio classifies +15 overdue and 0-15 vigente without AI',()=>{
 const rows=[
  deal('1','a@scb.com','Seguimiento','2026-08-10T00:00:00.000Z','Viejo'),
  deal('2','a@scb.com','Horno','2026-08-25T00:00:00.000Z','Reciente'),
  deal('3','a@scb.com','Cotizado para enviar','2026-09-07T00:00:00.000Z','Hoy'),
  deal('4','a@scb.com','Marca personal','2026-09-14T00:00:00.000Z','Semana'),
  deal('5','b@scb.com','Para cotizar','2026-09-22T00:00:00.000Z','Quince'),
  deal('6','b@scb.com','Perdido','2026-09-10T00:00:00.000Z','Cerrado')
 ];
 const r=closeCrmPortfolio(rows,'2026-09-07');
 assert.equal(r.totalOverdue15,1);
 assert.equal(r.totalOverdueRecent,1);
 assert.equal(r.totalVigent15,3);
 const a=r.sellers.find(x=>x.seller==='a@scb.com');
 assert.equal(a.vigent15,2);
 assert.equal(a.dueToday,1);
 assert.equal(a.due7,1);
});

test('0.13.15 close preserves opportunities and seller summary and adds deterministic CRM blocks',()=>{
 const rows=[{
  conversationId:'c1',contactName:'Cliente',seller:'v@scb.com',owner:'v@scb.com',
  inboundCount:1,humanResponded:true,messagesInWindow:2,humanCount:1,
  commercialAdvance:true,goodCommercialResponse:true,
  ai:{product_defined:true,product_name:'máquina',commercial_advance:true,commercial_advance_reason:'Cotización enviada'}
 }];
 const dealStates=[deal('d1','v@scb.com','Seguimiento','2026-08-01T00:00:00.000Z','Viejo'),
                   deal('d2','v@scb.com','Horno','2026-09-10T00:00:00.000Z','Cierre próximo','c1')];
 const text=closeText({date:'2026-09-07',base:{},rows,dealStates});
 assert.ok(text.includes('📌 CARTERA CRM — CÁLCULO DETERMINÍSTICO, SIN IA'));
 assert.ok(text.includes('🔴 VENCIDOS +15 DÍAS — POR VENDEDOR'));
 assert.ok(text.includes('🟢 VIGENTES 0–15 DÍAS — PARA EMPUJAR CIERRE'));
 assert.ok(text.includes('🔥 OPORTUNIDADES DEL DÍA'));
 assert.ok(text.includes('📋 RESUMEN POR VENDEDOR'));
 assert.ok(text.includes('Cierre próximo'));
});

test('0.13.15 UI documents no-AI CRM portfolio',()=>{
 const s=fs.readFileSync('public/index.html','utf8');
 assert.ok(s.includes('cartera CRM se calcula SIN IA'));
});
