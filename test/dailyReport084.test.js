const test=require('node:test');
const assert=require('node:assert/strict');
const {summary,html,managerText,hubUrl}=require('../src/core/dailyGerencial');

test('seller response rate counts responded client conversations only',()=>{
  const rows=[
    {seller:'a@scb.com',inboundCount:1,humanResponded:true,humanCount:3},
    {seller:'a@scb.com',inboundCount:1,humanResponded:false,humanCount:0,noHumanResponse:true},
    {seller:'a@scb.com',inboundCount:0,humanResponded:true,humanCount:2,followUpOk:true}
  ];
  const [s]=summary(rows);
  assert.equal(s.clientChats,2);
  assert.equal(s.respondedClientChats,1);
  assert.equal(s.responseRate,50);
  assert.equal(s.humanActivityChats,2);
  assert.equal(s.humanMessages,5);
  assert.ok(s.responseRate<=100);
});

test('HUB link uses production conversation formula and encodes id',()=>{
  assert.equal(hubUrl('54911+__x y'),'https://hub.sentirecustomsbroker.com/?conversationId=54911%2B__x%20y');
});

test('daily email is structured and exposes direct HUB action for relevant cases',()=>{
  const report={date:'2026-08-28',generatedAt:'2026-08-30T17:00:00Z',businessHours:'09:00 a 17:00',lateMinutes:30,aiUsedCount:1,
    rows:[{conversationId:'c__1',hubUrl:hubUrl('c__1'),contactName:'Cliente Uno',seller:'a@scb.com',inboundCount:1,humanResponded:true,humanCount:2,noHumanResponse:false,botOnly:false,lateCount:1,maxHumanResponseMinutes:45,goodCommercialResponse:false,operationalWithoutDiscovery:true,unexploredPotential:true,needsReviewByAi:true,lastClientText:'quiero importar',lastHumanText:'pasame peso',ai:{overall_score:50,sales_coaching:'Faltó discovery'}}],
    bySeller:summary([{seller:'a@scb.com',inboundCount:1,humanResponded:true,humanCount:2,lateCount:1,goodCommercialResponse:false,operationalWithoutDiscovery:true,unexploredPotential:true,needsReviewByAi:true}]),
    portfolio:{total:10,upToDate:3,overdue:5,noDueDate:2},hunter:{total:7,sellers:1},events:{HORNO:1,GANADO:1,GANADO_FROM_AD:1}
  };
  const out=html(report);
  assert.match(out,/<!doctype html>/i);
  assert.match(out,/Rendimiento por vendedor/);
  assert.match(out,/Calidad comercial IA/);
  assert.match(out,/Casos importantes/);
  assert.match(out,/Ver conversación/);
  assert.match(out,/https:\/\/hub\.sentirecustomsbroker\.com\/\?conversationId=c__1/);
  assert.match(out,/50%|100%/);
});

test('daily text distinguishes client response from human message activity',()=>{
  const report={date:'2026-08-28',businessHours:'09:00 a 17:00',lateMinutes:30,aiUsedCount:0,
    rows:[{conversationId:'c1',contactName:'X',seller:'a@scb.com',inboundCount:1,humanResponded:true,humanCount:3,lateCount:0,noHumanResponse:false,botOnly:false,goodCommercialResponse:false,operationalWithoutDiscovery:false,unexploredPotential:true,needsReviewByAi:true,followUpOk:false,readyToDiscardNoResponse:false}],
    bySeller:summary([{seller:'a@scb.com',inboundCount:1,humanResponded:true,humanCount:3}]),portfolio:{total:0,upToDate:0,overdue:0,noDueDate:0},hunter:{total:0,sellers:0},events:{HORNO:0,GANADO:0,GANADO_FROM_AD:0}
  };
  const out=managerText(report);
  assert.match(out,/Clientes respondidos por humano: 1 \(100%\)/);
  assert.match(out,/Mensajes humanos detectados: 3/);
  assert.match(out,/HUB: https:\/\/hub\.sentirecustomsbroker\.com\/\?conversationId=c1/);
});
