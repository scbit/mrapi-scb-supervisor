const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const {RemoteSupervisorService}=require('../src/core/remoteSupervisor');

test('weekend test can send to UI chat override without saved weekend chat',async()=>{
  let sentTo=null;
  const svc=new RemoteSupervisorService({
    store:{
      getSupervisionSettings:async()=>({weekend:{chatId:null,frequencyMinutes:120,startTime:'09:00',endTime:'24:00'},weekday:{}}),
      listRemoteSupervisors:async()=>[],listAllDeals:async()=>[]
    },
    crm:{listUsers:async()=>[]},
    inbox:{listConversationsInRange:async()=>[]},
    aiProvider:{},
    telegram:{send:async(_text,chatId)=>{sentTo=chatId;return{ok:true}}}
  });
  const r=await svc.testWeekend({send:true,chatIdOverride:'-100999'});
  assert.equal(sentTo,'-100999');
  assert.equal(r.report.mode,'weekend_guard');
});

test('0.9.6 UI passes current weekend/general chat when sending test',()=>{
  const html=fs.readFileSync('public/index.html','utf8');
  assert.ok(html.includes("JSON.stringify({send,chatId})"));
  assert.ok(html.includes("grupo de guardia"));
});

test('weekend report uses real line breaks',async()=>{
  const svc=new RemoteSupervisorService({
    store:{
      getSupervisionSettings:async()=>null,listRemoteSupervisors:async()=>[],listAllDeals:async()=>[]
    },
    crm:{listUsers:async()=>[]},
    inbox:{listConversationsInRange:async()=>[]},
    aiProvider:{},
    telegram:{}
  });
  const r=await svc.buildWeekendGlobalReport({now:new Date('2026-09-05T13:00:00-03:00')});
  assert.ok(r.text.includes('\n'));
  assert.equal(r.text.includes('\\n'),false);
});
