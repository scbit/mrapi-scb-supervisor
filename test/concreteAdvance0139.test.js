const test=require('node:test');
const assert=require('node:assert/strict');
const {applyAi}=require('../src/core/dailyGerencial');
const {metrics}=require('../src/core/manualSupervision');

test('0.13.9 Bety-type case is not good without guided supplier search or next step',()=>{
  const row={conversationId:'b',contactName:'Bety',seller:'Augusto',messagesInWindow:2,inboundCount:1,humanCount:1,humanResponded:true,humanTexts:[{text:'Buscá en Alibaba'}]};
  const out=applyAi(row,{
    commercial_advance:true,
    commercial_advance_type:'MODE_RECOMMENDATION',
    commercial_advance_reason:'Se confirmó producto y cantidad, pero no quedó próximo paso concreto y se la mandó a buscar sola en Alibaba.',
    useful_recommendation:false,
    concrete_next_step:false,
    product_defined:true,
    product_name:'plancha sublimadora con DTF',
    overall_score:70
  });
  assert.equal(out.commercialAdvance,false);
  const m=metrics([out]);
  assert.equal(m.good,0);
  assert.equal(m.toCorrect,1);
});

test('0.13.9 guided Alibaba supplier search is a valid advance',()=>{
  const row={conversationId:'g',contactName:'Cliente',seller:'Augusto',messagesInWindow:2,inboundCount:1,humanCount:1,humanResponded:true,humanTexts:[{text:'Buscá 2 o 3 proveedores'}]};
  const out=applyAi(row,{
    commercial_advance:true,
    commercial_advance_type:'GUIDED_SUPPLIER_SEARCH',
    commercial_advance_reason:'Se indicó comparar 2-3 proveedores y volver con links, MOQ, precio, peso y medidas para cotizar.',
    useful_recommendation:true,
    concrete_next_step:true,
    overall_score:80
  });
  assert.equal(out.commercialAdvance,true);
  assert.equal(metrics([out]).good,1);
});

test('0.13.9 merely keeping conversation open is not a valid advance',()=>{
  const row={conversationId:'a',contactName:'Alexis',seller:'Augusto',messagesInWindow:2,inboundCount:1,humanCount:1,humanResponded:true,humanTexts:[{text:'Después hablamos'}]};
  const out=applyAi(row,{
    commercial_advance:true,
    commercial_advance_type:'CALL_AGREED',
    commercial_advance_reason:'No avanzó demasiado, pero mantuvo abierta la conversación para continuar por llamada.',
    useful_recommendation:false,
    concrete_next_step:false,
    overall_score:75
  });
  assert.equal(out.commercialAdvance,false);
  assert.equal(metrics([out]).toCorrect,1);
});
