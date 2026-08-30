const test=require('node:test');
const assert=require('node:assert/strict');
const {buildLeadQualityInsights,html,managerText}=require('../src/core/dailyGerencial');

test('crosses hard CRM EXCELENTE quality with Supervisor handling without inventing lead quality',()=>{
  const deals=[{id:'d1',owner:'a@scb.com',leadQuality:'EXCELENTE'},{id:'d2',owner:'b@scb.com',leadQuality:'EXCELENTE'},{id:'d3',owner:'c@scb.com',leadQuality:'BUENO'}];
  const rows=[
    {dealId:'d1',contactName:'Lead malo',seller:'a@scb.com',conversationId:'c1',hubUrl:'https://hub.sentirecustomsbroker.com/?conversationId=c1',noHumanResponse:false,botOnly:false,lateCount:1,maxHumanResponseMinutes:90,operationalWithoutDiscovery:false,unexploredPotential:true,humanResponded:true,goodCommercialResponse:false,ai:{overall_score:52}},
    {dealId:'d2',contactName:'Lead bueno',seller:'b@scb.com',conversationId:'c2',hubUrl:'https://hub.sentirecustomsbroker.com/?conversationId=c2',noHumanResponse:false,botOnly:false,lateCount:0,operationalWithoutDiscovery:false,unexploredPotential:false,humanResponded:true,goodCommercialResponse:true,ai:{overall_score:82}}
  ];
  const x=buildLeadQualityInsights(deals,rows);
  assert.equal(x.excellentTotal,2);
  assert.equal(x.excellentPoorlyWorked.length,1);
  assert.equal(x.excellentWellWorked.length,1);
  assert.ok(x.excellentPoorlyWorked[0].reasons.some(r=>r.includes('RESPUESTA TARDE')));
});

test('final daily email and text expose excellent-lead actionable blocks',()=>{
  const report={date:'2026-08-28',businessHours:'09:00 a 17:00',lateMinutes:30,rows:[],bySeller:[],aiUsedCount:0,portfolio:{total:0,upToDate:0,overdue:0,noDueDate:0},hunter:{total:0,sellers:0},events:{HORNO:0,GANADO:0,GANADO_FROM_AD:0},leadQuality:{available:true,total:1,counts:{EXCELENTE:1,BUENO:0,REGULAR:0,NO_RESPONDE:0,DESCARTADO:0},goodExcellent:1,goodExcellentPct:100,bySeller:[]},leadQualityInsights:{available:true,excellentTotal:1,excellentPoorlyWorked:[{contactName:'A',seller:'a@scb.com',reasons:['SIN RESPUESTA HUMANA'],hubUrl:'https://hub.sentirecustomsbroker.com/?conversationId=c1'}],excellentWellWorked:[]}};
  assert.match(managerText(report),/LEADS EXCELENTES MAL APROVECHADOS/);
  const h=html(report);
  assert.match(h,/Leads Excelentes: aprovechamiento comercial/);
  assert.match(h,/Ver conversación/);
});
