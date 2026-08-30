const test=require('node:test');
const assert=require('node:assert/strict');
const {formatEmailReport,buildReport}=require('../src/core/report');

function sample(){return{
  generatedAt:'2026-08-30T15:06:00.000Z',timezone:'America/Argentina/Buenos_Aires',
  inbox:{waiting:117,pendingAssignment:88,maxWaitingMinutes:2741,waitingBuckets:{PLUS_15:0,PLUS_30:1,PLUS_60:115}},
  portfolio:{total:3842,upToDate:411,overdue:2721,noDueDate:710},
  followUps:{total:2712,DUE:356,PLUS_15:263,PLUS_30:2040,PLUS_60:53},
  sellers:[
    {label:'Agente AMBA Augusto Vera',activeDeals:825,upToDateDeals:46,overdueDeals:714,waiting:5,hunterToday:0,hunterLast30m:0,activity:'INACTIVO'},
    {label:'Agente NQN Florencia Zanin',activeDeals:210,upToDateDeals:118,overdueDeals:10,waiting:2,hunterToday:0,hunterLast30m:0,activity:'INACTIVO'}
  ],events:{HORNO:0,GANADO:0,GANADO_FROM_AD:0}
}}

test('email renderer produces Outlook-friendly structured HTML',()=>{
  const html=formatEmailReport(sample());
  assert.match(html,/<!doctype html>/i);
  assert.match(html,/role="presentation"/);
  assert.match(html,/ATENCIÓN AHORA/);
  assert.match(html,/CARTERA VIGENTE/);
  assert.match(html,/CARTERA AL DÍA — TODOS/);
  assert.match(html,/REQUIEREN ATENCIÓN/);
  assert.match(html,/Augusto Vera/);
  assert.match(html,/Florencia Zanin/);
  assert.match(html,/3\.842/);
  assert.doesNotMatch(html,/white-space:pre-wrap/);
});

test('buildReport persists separate text and html renderers',()=>{
  const r=buildReport({runId:'r',now:new Date('2026-08-30T15:06:00Z'),inbox:{changed:0,pendingAssignment:0,waiting:0,maxWaitingMinutes:0},hunterBySeller:new Map(),followUpRows:[],activeDealRows:[],waitingRows:[],conversationRows:[],events:[],sellerLabels:new Map(),sellerRoster:[],timezone:'America/Argentina/Buenos_Aires'});
  assert.equal(typeof r.text,'string');
  assert.equal(typeof r.html,'string');
  assert.match(r.html,/SUPERVISOR SCB/);
  assert.notEqual(r.html,r.text);
});
