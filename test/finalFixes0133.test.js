const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const {metrics,liveText,manualReportKey}=require('../src/core/manualSupervision');

test('0.13.3 good and to-correct are mutually exclusive under SCB guide',()=>{
  const bad={conversationId:'1',contactName:'A',seller:'x',inboundCount:1,humanResponded:true,operationalWithoutDiscovery:true,ai:{product_defined:true,product_name:'X'}};
  const good={conversationId:'2',contactName:'B',seller:'x',inboundCount:1,humanResponded:true,goodCommercialResponse:true,ai:{product_defined:true,product_name:'Y',guide_checklist:{understood_business:true,knows_import_experience:true,knows_supplier:true,explained_scb_value:true,gave_useful_recommendation:true,left_concrete_next_step:true}}};
  const m=metrics([bad,good]);assert.equal(m.good+m.toCorrect,2);assert.equal(m.toCorrect,1);assert.equal(m.good,1);
});
test('0.13.3 live report hides SUPERSEDED and uses product discovered by label',()=>{
  const row={conversationId:'1',contactName:'A',seller:'x',inboundCount:1,humanResponded:true,operationalWithoutDiscovery:true,ai:{product_defined:true,product_name:'Máquina',product_source:'CLIENTE'}};
  const t=liveText({date:'2026-09-04',cutoff:17,label:'Augusto',rows:[row],correctionStatuses:{'1':'SUPERSEDED'}});
  assert.ok(!t.includes('SUPERSEDED'));assert.ok(t.includes('PENDIENTE'));assert.ok(t.includes('Producto descubierto por: CLIENTE'));
});
test('0.13.3 seller-specific manual cache key differs from global',()=>{
  assert.notEqual(manualReportKey('2026-09-04',17,'avera@sentirecustomsbroker.com'),manualReportKey('2026-09-04',17));
});
test('0.13.3 daily gerencial prefilters conversations by seller before processing',()=>{
  const s=fs.readFileSync('src/core/dailyGerencial.js','utf8');
  assert.ok(s.includes("conversations=conversations.filter(c=>String(c.owner||'').trim().toLowerCase()===sellerNorm)"));
});
test('0.13.3 Telegram refresh merges detected and configured groups with visible feedback',()=>{
  const s=fs.readFileSync('public/index.html','utf8');
  assert.ok(s.includes('Actualizando grupos del bot…'));
  assert.ok(s.includes('configured=(setupResp.sellerGroups||[])'));
  assert.ok(s.includes('grupos configurados disponibles'));
});
