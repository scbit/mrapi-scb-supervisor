const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const {buildSellerReport,metrics,compareMetrics}=require('../src/core/dailyV3Live');

test('0.12.0 seller Daily V3 filters all rows to selected seller and keeps HUB links',()=>{
  const base={date:'2026-09-04',businessHours:'09:00 a 17:00',lateMinutes:30,
    rows:[
      {conversationId:'a',seller:'avera@sentirecustomsbroker.com',owner:'avera@sentirecustomsbroker.com',inboundCount:1,humanResponded:true,humanCount:1,goodCommercialResponse:false,operationalWithoutDiscovery:true,unexploredPotential:true,hubUrl:'https://hub/?conversationId=a'},
      {conversationId:'b',seller:'otro@x.com',owner:'otro@x.com',inboundCount:1,humanResponded:true,humanCount:1}
    ],
    leadQuality:{available:false},leadQualityInsights:{available:false},
    portfolio:{total:0,upToDate:0,overdue:0,noDueDate:0},hunter:{total:0,sellers:0},events:{HORNO:0,GANADO:0,GANADO_FROM_AD:0},aiUsedCount:1
  };
  const r=buildSellerReport(base,'avera@sentirecustomsbroker.com','Augusto');
  assert.equal(r.rows.length,1);
  assert.equal(r.rows[0].conversationId,'a');
  assert.ok(r.text.includes('HUB: https://hub/?conversationId=a'));
  assert.equal(r.dailyV3MotherLogic,true);
});

test('0.12.0 comparison says MEJORO when commercial quality improves and misses fall',()=>{
  const a={goodRate:0,lateRate:40,noDiscoveryRate:100,unexploredRate:100,noHumanResponse:0};
  const b={goodRate:40,lateRate:20,noDiscoveryRate:40,unexploredRate:40,noHumanResponse:0};
  const c=compareMetrics(a,b);
  assert.equal(c.verdict,'MEJORO');
  assert.ok(c.score>0);
});

test('0.12.0 comparison says EMPEORO for worse day',()=>{
  const a={goodRate:60,lateRate:0,noDiscoveryRate:20,unexploredRate:20,noHumanResponse:0};
  const b={goodRate:0,lateRate:50,noDiscoveryRate:100,unexploredRate:100,noHumanResponse:1};
  assert.equal(compareMetrics(a,b).verdict,'EMPEORO');
});

test('0.12.0 UI exposes mother Daily V3 manual report and day comparison',()=>{
  const s=fs.readFileSync('public/index.html','utf8');
  assert.ok(s.includes('Supervisor Diario en Vivo · misma lógica Daily V3'));
  assert.ok(s.includes('Generar Daily V3 del día'));
  assert.ok(s.includes('Comparar mejora entre dos días'));
  assert.ok(s.includes('Comparar días'));
  assert.ok(s.includes('details class="sellerAccordion"'));
});

test('0.12.0 HTTP exposes manual generate and compare endpoints',()=>{
  const s=fs.readFileSync('src/http/app.js','utf8');
  assert.ok(s.includes('/api/supervisor/daily-v3-live/generate'));
  assert.ok(s.includes('/api/supervisor/daily-v3-live/compare'));
});
