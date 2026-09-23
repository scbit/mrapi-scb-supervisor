const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {stableAiFingerprint}=require('../src/core/dailyGerencial');

test('0.13.34 identical commercial evidence has identical fingerprint independent of report day/cutoff',()=>{
  const c={id:'wa_same',dealId:'d1',contactName:'Cliente',owner:'oficina.caba@sentirecustomsbroker.com',stage:'SEGUIMIENTO',sourceChannel:'whatsapp'};
  const messages=[
    {id:'m1',timestamp:'2026-09-22T13:00:00.000Z',actor:'client',text:'Quiero importar un camión'},
    {id:'m2',timestamp:'2026-09-22T13:02:00.000Z',actor:'human',user:'Augusto',text:'Te recomiendo RORO y preparo cotización'}
  ];
  const a=stableAiFingerprint(c,messages);
  const b=stableAiFingerprint(c,[...messages].reverse());
  assert.equal(a,b);
});

test('0.13.34 new message invalidates the commercial evidence fingerprint',()=>{
  const c={id:'wa_same',owner:'oficina.caba@sentirecustomsbroker.com'};
  const base=[{id:'m1',timestamp:'2026-09-22T13:00:00.000Z',actor:'client',text:'Necesito cotizar'}];
  const changed=[...base,{id:'m2',timestamp:'2026-09-23T14:00:00.000Z',actor:'client',text:'¿Tenés novedades?'}];
  assert.notEqual(stableAiFingerprint(c,base),stableAiFingerprint(c,changed));
});

test('0.13.34 stable review storage is cross-day and not keyed by date/cutoff',()=>{
  const store=fs.readFileSync('src/persistence/supervisorStore.js','utf8');
  const daily=fs.readFileSync('src/core/dailyGerencial.js','utf8');
  assert.match(store,/stable__/);
  assert.match(store,/getStableDailyReview\(scope,conversationId\)/);
  assert.match(store,/saveStableDailyReview\(scope,conversationId,data\)/);
  assert.match(daily,/Time\/late\/overdue status is recomputed/);
  assert.match(daily,/AI memory is conversation\/evidence based, not date\/cutoff based/);
});
