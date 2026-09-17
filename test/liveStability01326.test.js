const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const {ManualSupervisionService}=require('../src/core/manualSupervision');

function row(overrides={}){return {
  conversationId:'c1',seller:'augusto@scb.com',owner:'augusto@scb.com',contactName:'Cliente',
  messagesInWindow:2,inboundCount:1,humanCount:1,humanResponded:true,noHumanResponse:false,botOnly:false,
  lateCount:0,maxHumanResponseMinutes:5,commercialAdvance:true,goodCommercialResponse:true,
  lastClientText:'quiero importar autos RC',lastHumanText:'te recomiendo courier por este volumen',
  clientTexts:['quiero importar autos RC'],humanTexts:[{text:'te recomiendo courier por este volumen'}],
  ai:{product_name:'autos RC',commercial_advance_reason:'recomendó modalidad concreta'},...overrides
}}
function store(){const reports=[];return {
  reports,
  async listLiveDailyReports(_limit,date=null){return reports.filter(r=>!date||r.date===date).sort((a,b)=>String(b.generatedAt||'').localeCompare(String(a.generatedAt||'')))},
  async listLiveDailyObservationsForSellers(){return[]},
  async saveLiveDailyReport(id,data){const i=reports.findIndex(x=>x.id===id);if(i>=0)reports[i]={...reports[i],...data};else reports.push({...data,id})}
}}

test('0.13.26 keeps BIEN TRABAJADO stable when chat evidence did not change',async()=>{
  const st=store(),svc=new ManualSupervisionService({dailyService:{},store:st});
  const first=await svc.liveSellerFromBase({base:{rows:[row()]},date:'2026-09-16',cutoff:11,sellerKey:'augusto@scb.com',sellerLabel:'Augusto'});
  assert.equal(first.cases[0].status,'BIEN TRABAJADO');
  const changedAiOnly=row({commercialAdvance:false,goodCommercialResponse:false,ai:{product_name:'autos RC',sales_coaching:'faltó discovery'}});
  const second=await svc.liveSellerFromBase({base:{rows:[changedAiOnly]},date:'2026-09-16',cutoff:12,sellerKey:'augusto@scb.com',sellerLabel:'Augusto'});
  assert.equal(second.cases[0].status,'BIEN TRABAJADO');
  assert.equal(second.metrics.toCorrect,0);
});

test('0.13.26 current state can improve and snapshot records correction',async()=>{
  const st=store(),svc=new ManualSupervisionService({dailyService:{},store:st});
  const bad=row({commercialAdvance:false,goodCommercialResponse:false,lastHumanText:'hola como estas',humanTexts:[{text:'hola como estas'}],ai:{product_name:'autos RC',sales_coaching:'saludo genérico'}});
  const first=await svc.liveSellerFromBase({base:{rows:[bad]},date:'2026-09-16',cutoff:11,sellerKey:'augusto@scb.com',sellerLabel:'Augusto'});
  assert.equal(first.cases[0].status,'A CORREGIR');
  const good=row({lastHumanText:'te recomiendo courier y te cotizo hoy',humanTexts:[{text:'te recomiendo courier y te cotizo hoy'}]});
  const second=await svc.liveSellerFromBase({base:{rows:[good]},date:'2026-09-16',cutoff:14,sellerKey:'augusto@scb.com',sellerLabel:'Augusto'});
  assert.equal(second.cases[0].status,'BIEN TRABAJADO');
  assert.equal(second.evolution.correctedSincePrevious,1);
  assert.equal(second.metrics.toCorrect,0);
  assert.match(second.text,/Evolución hoy: corregidos 1/);
});

test('0.13.26 new evidence allows a case to be re-evaluated',async()=>{
  const st=store(),svc=new ManualSupervisionService({dailyService:{},store:st});
  await svc.liveSellerFromBase({base:{rows:[row()]},date:'2026-09-16',cutoff:11,sellerKey:'augusto@scb.com',sellerLabel:'Augusto'});
  const newer=row({commercialAdvance:false,goodCommercialResponse:false,messagesInWindow:3,humanCount:2,lastHumanText:'cualquier cosa avisame',humanTexts:[{text:'te recomiendo courier por este volumen'},{text:'cualquier cosa avisame'}],ai:{product_name:'autos RC',sales_coaching:'cierre pasivo'}});
  const second=await svc.liveSellerFromBase({base:{rows:[newer]},date:'2026-09-16',cutoff:12,sellerKey:'augusto@scb.com',sellerLabel:'Augusto'});
  assert.equal(second.cases[0].status,'A CORREGIR');
  assert.equal(second.evolution.newProblems,1);
});

test('0.13.26 automatic Live uses fixed hours and skips empty Telegram reports',()=>{
  const s=fs.readFileSync('src/http/app.js','utf8');
  assert.ok(s.includes('[9,11,12,14,15,16]'));
  assert.ok(s.includes("reason:'LIVE_NOT_DUE'"));
  assert.ok(s.includes("reason:'LIVE_NO_ACTIVITY'"));
  assert.ok(s.includes('approved_live_slot__'));
  assert.ok(s.includes('if(!hasActivity)return'));
});

test('0.13.26 default settings persist requested live schedule',()=>{
  const s=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
  assert.ok(s.includes('liveScheduleHours:[9,11,12,14,15,16]'));
});
