const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const {RemoteSupervisorService}=require('../src/core/remoteSupervisor');

test('0.9.7 network defaults expose independent general days and hours',()=>{
  const svc=new RemoteSupervisorService({store:{},crm:{},inbox:{},aiProvider:{},telegram:{}});
  const w=svc.defaultNetworkSettings().weekday;
  assert.deepEqual(w.generalDays,['Mon','Tue','Wed','Thu','Fri']);
  assert.equal(w.generalStartTime,'09:00');
  assert.equal(w.generalEndTime,'17:00');
});

test('0.9.7 UI exposes independent general schedule controls',()=>{
  const html=fs.readFileSync('public/index.html','utf8');
  for(const x of ['generalDayCb','generalStart','generalEnd','Este grupo tiene su propio calendario y horario']) assert.ok(html.includes(x),x);
});

test('0.9.7 UI persists general schedule independently',()=>{
  const html=fs.readFileSync('public/index.html','utf8');
  assert.ok(html.includes("generalDays:checkedValues('.generalDayCb')"));
  assert.ok(html.includes("generalStartTime:generalStart.value||'09:00'"));
  assert.ok(html.includes("generalEndTime:generalEnd.value||'17:00'"));
});
