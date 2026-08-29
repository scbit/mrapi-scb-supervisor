const test=require('node:test');
const assert=require('node:assert/strict');
const {buildReport,cleanSellerLabel,attentionSellers}=require('../src/core/report');

function reportWithSellers(sellers=[]){
  const r={
    runId:'r',generatedAt:'2026-08-29T18:21:00.000Z',timezone:'America/Argentina/Buenos_Aires',
    inbox:{waiting:62,pendingAssignment:37,maxWaitingMinutes:1496,waitingBuckets:{PLUS_15:0,PLUS_30:1,PLUS_60:60}},
    portfolio:{total:3842,upToDate:411,overdue:2721,noDueDate:710},followUps:{total:2712,DUE:356,PLUS_15:263,PLUS_30:2040,PLUS_60:53},
    sellers,events:{HORNO:0,GANADO:0,GANADO_FROM_AD:0}
  };
  const {formatReport}=require('../src/core/report');
  return formatReport(r);
}

test('cleans display-only seller labels without merging identities',()=>{
  assert.equal(cleanSellerLabel('Agente AMBA Augusto Vera'),'Augusto Vera');
  assert.equal(cleanSellerLabel('Agente NQN Florencia Zanin'),'Florencia Zanin');
  assert.equal(cleanSellerLabel('nqn@sentirecustomsbroker.com'),'Cuenta NQN');
  assert.equal(cleanSellerLabel('oficina.caba@sentirecustomsbroker.com'),'Oficina CABA');
});

test('general report uses compact rankings and does not dump full seller list twice',()=>{
  const sellers=[
    {label:'Agente AMBA Augusto Vera',activeDeals:825,upToDateDeals:46,overdueDeals:714,noDueDateDeals:65,waiting:3,hunterToday:0,hunterLast30m:0,activity:'INACTIVO'},
    {label:'Oficina CABA',activeDeals:732,upToDateDeals:49,overdueDeals:622,noDueDateDeals:61,waiting:15,hunterToday:0,hunterLast30m:0,activity:'INACTIVO'},
    {label:'Agente NQN Florencia Zanin',activeDeals:210,upToDateDeals:118,overdueDeals:10,noDueDateDeals:82,waiting:1,hunterToday:0,hunterLast30m:0,activity:'INACTIVO'}
  ];
  const text=reportWithSellers(sellers);
  assert.match(text,/📊 CARTERA VIGENTE\n\nTotal: 3842/);
  assert.match(text,/🏅 TOP CARTERA/);
  assert.match(text,/🔴 MAYOR CARTERA VENCIDA/);
  assert.match(text,/🟢 MAYOR CARTERA AL DÍA/);
  assert.match(text,/👥 REQUIEREN ATENCIÓN/);
  assert.match(text,/Augusto Vera/);
  assert.doesNotMatch(text,/Agente AMBA Augusto Vera/);
  assert.ok(text.length<=4090);
});

test('attention list is capped and prioritizes waiting',()=>{
  const sellers=Array.from({length:20},(_,i)=>({label:`S${i}`,activeDeals:100-i,upToDateDeals:0,overdueDeals:100-i,waiting:i===19?5:0,hunterLast30m:0,hunterToday:0,activity:'INACTIVO'}));
  const rows=attentionSellers(sellers);
  assert.equal(rows.length,10);
  assert.equal(rows[0].label,'S19');
});

test('buildReport renders Argentina local time',()=>{
  const r=buildReport({runId:'r',now:new Date('2026-08-29T18:21:00Z'),inbox:{changed:0,pendingAssignment:0,waiting:0,maxWaitingMinutes:0},hunterBySeller:new Map(),followUpRows:[],activeDealRows:[],waitingRows:[],conversationRows:[],events:[],sellerLabels:new Map(),sellerRoster:[],timezone:'America/Argentina/Buenos_Aires'});
  assert.match(r.text,/SUPERVISOR SCB — 15:21/);
});
