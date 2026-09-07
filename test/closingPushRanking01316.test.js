const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const {closeCrmPortfolio,closeText,ManualSupervisionService,technicalDealLabel}=require('../src/core/manualSupervision');

function deal(id,owner,stage,due,title='',conversationId=''){
 return {id,snapshot:{owner,stage,stageNorm:String(stage).toUpperCase(),dueDate:due,title,conversationId}};
}

test('0.13.16 ranks 0-15 deals by commercial stage then due date',()=>{
 const rows=[
  deal('a','v','SEGUIMIENTO','2026-09-07','Seg hoy'),
  deal('b','v','HORNO','2026-09-10','Horno tres'),
  deal('c','v','COTIZADO PARA ENVIAR','2026-09-08','Cotizado'),
  deal('d','v','HORNO','2026-09-07','Horno hoy')
 ];
 const p=closeCrmPortfolio(rows,'2026-09-07');
 assert.deepEqual(p.sellers[0].vigentDeals.map(x=>x.id),['d','b','c','a']);
});

test('0.13.16 never treats technical id as useful label',()=>{
 assert.equal(technicalDealLabel('BYDxPsUbvYrogNjxqVhV','BYDxPsUbvYrogNjxqVhV'),true);
 assert.equal(technicalDealLabel('Marcelo Bari','abc123'),false);
});

test('0.13.16 close renders A EMPUJAR HOY and hides technical ids',()=>{
 const dealStates=[
  deal('BYDxPsUbvYrogNjxqVhV','v@scb.com','HORNO','2026-09-07','BYDxPsUbvYrogNjxqVhV'),
  deal('d2','v@scb.com','COTIZADO PARA ENVIAR','2026-09-08','Cliente Real','conv2')
 ];
 const text=closeText({date:'2026-09-07',base:{},rows:[],dealStates});
 assert.ok(text.includes('🎯 A EMPUJAR HOY:'));
 assert.ok(text.includes('Cliente sin nombre'));
 assert.ok(text.includes('Cliente Real'));
 assert.ok(!text.includes('BYDxPsUbvYrogNjxqVhV'));
});

test('0.13.16 enriches only missing top labels from CRM without AI',async()=>{
 const states=[deal('x1','v@scb.com','HORNO','2026-09-07','x1')];
 let reads=0;
 const dailyService={crm:{getDeal:async id=>{reads++;return{id,title:'Cliente Recuperado',conversationId:'conv1'}}}};
 const svc=new ManualSupervisionService({dailyService,store:{}});
 await svc.enrichClosingDeals(states,'2026-09-07');
 assert.equal(reads,1);
 assert.equal(states[0].snapshot.title,'Cliente Recuperado');
 assert.equal(states[0].snapshot.conversationId,'conv1');
});

test('0.13.16 engine persists deal title on CRM sync',()=>{
 const s=fs.readFileSync('src/core/engine.js','utf8');
 assert.ok(s.includes('snapshot:{id:d.id,title:d.title,contactId:d.contactId'));
});
