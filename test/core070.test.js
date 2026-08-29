const test=require('node:test');const assert=require('node:assert/strict');const {classifyFollowUp}=require('../src/core/followUp');const {transitionEvents}=require('../src/core/events');const {aggregateFollowUps}=require('../src/core/report');
const cfg={timezone:'America/Argentina/Buenos_Aires',follow_up:{active_stages:['SEGUIMIENTO','MARCA PERSONAL','COTIZADO PARA ENVIAR','HORNO']}};
test('followup buckets',()=>{const now=new Date('2026-08-29T15:00:00Z');for(const [days,b] of [[1,'DUE'],[15,'PLUS_15'],[30,'PLUS_30'],[60,'PLUS_60']]){const due=new Date(now.getTime()-days*86400000).toISOString();assert.equal(classifyFollowUp({id:'x',stage:'Seguimiento',dueDate:due,isClosed:false},cfg,now).bucket,b)}});
test('bootstrap does not emit historical events',()=>assert.equal(transitionEvents({stageNorm:'HORNO'},{id:'x',stageNorm:'GANADO'},{bootstrap:true}).length,0));
test('won emits GANADO',()=>assert.equal(transitionEvents({stageNorm:'HORNO'},{id:'x',stageNorm:'GANADO'},{bootstrap:false}).some(x=>x.type==='GANADO'),true));
test('aggregate followups',()=>{const x=aggregateFollowUps([{followUp:{tracked:true,bucket:'PLUS_15',seller:'a'}}]);assert.equal(x.PLUS_15,1)});
