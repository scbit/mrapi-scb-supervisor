const test=require('node:test');
const assert=require('node:assert/strict');
const {classifyPortfolio}=require('../src/core/portfolio');
const {aggregatePortfolio,buildReport}=require('../src/core/report');
const cfg={portfolio:{active_stages:['SEGUIMIENTO','MARCA PERSONAL','PARA COTIZAR','COTIZADO PARA ENVIAR','HORNO','PENDIENTE DE PAGO']}};
const now=new Date('2026-08-29T18:00:00Z');

test('vigente with future dueDate is up to date',()=>{
  const x=classifyPortfolio({stage:'SEGUIMIENTO',dueDate:'2026-08-30T18:00:00Z'},cfg,now);
  assert.equal(x.active,true);assert.equal(x.upToDate,true);assert.equal(x.overdue,false);assert.equal(x.status,'UP_TO_DATE');
});

test('vigente with past dueDate is overdue',()=>{
  const x=classifyPortfolio({stage:'HORNO',dueDate:'2026-08-28T18:00:00Z'},cfg,now);
  assert.equal(x.active,true);assert.equal(x.upToDate,false);assert.equal(x.overdue,true);assert.equal(x.status,'OVERDUE');
});

test('vigente without dueDate is kept separate and is not called up to date',()=>{
  const x=classifyPortfolio({stage:'PARA COTIZAR'},cfg,now);
  assert.equal(x.active,true);assert.equal(x.noDueDate,true);assert.equal(x.upToDate,false);assert.equal(x.overdue,false);
});

test('NO RESPONDE is not vigente',()=>{
  const x=classifyPortfolio({stage:'NO RESPONDE',dueDate:'2026-08-30T18:00:00Z'},cfg,now);
  assert.equal(x.active,false);assert.equal(x.upToDate,false);
});

test('aggregatePortfolio splits total by due status and seller',()=>{
  const rows=[
    {portfolio:{active:true,upToDate:true},snapshot:{owner:'a@x.com'}},
    {portfolio:{active:true,overdue:true},snapshot:{owner:'a@x.com'}},
    {portfolio:{active:true,noDueDate:true},snapshot:{owner:'b@x.com'}}
  ];
  const x=aggregatePortfolio(rows);
  assert.deepEqual({total:x.total,up:x.upToDate,over:x.overdue,no:x.noDueDate},{total:3,up:1,over:1,no:1});
  assert.equal(x.bySeller['a@x.com'],2);
  assert.equal(x.bySellerBreakdown['a@x.com'].upToDate,1);
  assert.equal(x.bySellerBreakdown['a@x.com'].overdue,1);
});

test('report exposes Al día per seller',()=>{
  const r=buildReport({runId:'r',now,inbox:{changed:0,pendingAssignment:0,waiting:0,maxWaitingMinutes:0},hunterBySeller:new Map(),followUpRows:[],activeDealRows:[
    {portfolio:{active:true,upToDate:true},snapshot:{owner:'seller@x.com'}},
    {portfolio:{active:true,overdue:true},snapshot:{owner:'seller@x.com'}}
  ],waitingRows:[],conversationRows:[],events:[],sellerLabels:new Map(),sellerRoster:[{id:'seller',label:'Seller',email:'seller@x.com',raw:'seller@x.com'}]});
  assert.equal(r.portfolio.total,2);assert.equal(r.portfolio.upToDate,1);assert.equal(r.portfolio.overdue,1);
  assert.equal(r.sellers[0].upToDateDeals,1);assert.equal(r.sellers[0].overdueDeals,1);
  assert.match(r.text,/Al día: 1/);assert.match(r.text,/Seller — 2/);
});
