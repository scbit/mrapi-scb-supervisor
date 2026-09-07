const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const {applyAi}=require('../src/core/dailyGerencial');
const {liveText}=require('../src/core/manualSupervision');

test('0.13.5 generic human follow-up after bot context becomes correction',()=>{
  const row={conversationId:'x',contactName:'jotayjota',seller:'Augusto',inboundCount:0,humanResponded:true,humanTexts:[{text:'Hola buenos días, ¿cómo estás?'}],sellerFollowUpInWindow:true,followUpAttemptsAfterLastClient:1};
  const out=applyAi(row,{follow_up_quality:'INSUFICIENTE',follow_up_reason:'El bot ya detectó TV Box / Game Stick para negocio y el vendedor reinició con saludo genérico.',follow_up_expected_action:'Retomar TV Box/Game Stick, preguntar cantidad y explicar courier o marítimo según volumen.',product_defined:true,product_name:'TV Box / Game Stick',commercial_discovery_level:'bajo',overall_score:50});
  assert.equal(out.followUpNeedsCorrection,true);
  const t=liveText({date:'2026-09-04',cutoff:17,label:'Augusto',rows:[out]});
  assert.ok(t.includes('jotayjota — PENDIENTE'));
  assert.ok(t.includes('Producto: TV Box / Game Stick'));
  assert.ok(t.includes('Retomar TV Box/Game Stick'));
  assert.ok(t.includes('Seguimientos correctos: 0 · Seguimientos a corregir: 1'));
});
test('0.13.5 contextual follow-up can remain correct',()=>{
  const row={conversationId:'y',contactName:'Cliente',seller:'Augusto',inboundCount:0,humanResponded:true,humanTexts:[{text:'Según cantidad podemos ver courier o marítimo'}],sellerFollowUpInWindow:true,followUpAttemptsAfterLastClient:2};
  const out=applyAi(row,{follow_up_quality:'CORRECTO',product_defined:true,product_name:'TV Box',commercial_discovery_level:'medio',did_ask_volume_potential:true,overall_score:80});
  assert.equal(out.followUpCorrect,true);
  const t=liveText({date:'2026-09-04',cutoff:17,label:'Augusto',rows:[out]});
  assert.ok(t.includes('TODOS LOS CHATS DEL DÍA'));
  assert.ok(t.includes('CORRECTO · 2 intentos'));
});
test('0.13.5 AI prompt explicitly requires inheriting bot context',()=>{
  const s=fs.readFileSync('src/adapters/openaiAdapter.js','utf8');
  assert.ok(s.includes('el VENDEDOR HUMANO debe CONTINUAR desde ese contexto'));
  assert.ok(s.includes('"follow_up_quality": "NO_APLICA"'));
});
