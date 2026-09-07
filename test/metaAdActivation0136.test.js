const test=require('node:test');
const assert=require('node:assert/strict');
const {analyzeConversation}=require('../src/core/dailyGerencial');
const {liveText}=require('../src/core/manualSupervision');

const range={from:new Date('2026-09-04T09:00:00-03:00'),to:new Date('2026-09-04T17:00:00-03:00')};

test('0.13.6 ignores Meta ad bootstrap message followed immediately by bot',()=>{
 const c={id:'x',contactName:'....',owner:'Augusto',adId:'120252025312030019',sourceChannel:'meta_ad'};
 const msgs=[
  {id:'ad',actor:'client',text:'Importar por marítimo, optimizar costos aduanito',timestamp:'2026-09-03T18:21:05-03:00'},
  {id:'bot',actor:'bot',text:'¿Qué producto estás viendo para importar?',timestamp:'2026-09-03T18:21:06-03:00'},
  {id:'h1',actor:'human',user:'Augusto',text:'Hola buenos dias, como estas?',timestamp:'2026-09-04T09:04:15-03:00'}
 ];
 const r=analyzeConversation(c,msgs,range,30);
 assert.equal(r.adBootstrapIgnored,true);
 assert.equal(r.inboundCount,0);
 assert.equal(r.leadActivationRequired,true);
 assert.equal(r.leadActivationAttempts,1);
 assert.equal(r.leadActivationInsufficient,true);
});
test('0.13.6 activation report shows 1/3 not fake 0-minute response',()=>{
 const row={conversationId:'x',contactName:'....',seller:'Augusto',inboundCount:0,humanResponded:true,humanCount:1,leadActivationRequired:true,leadActivationAttempts:1,leadActivationInsufficient:true,ai:{product_defined:false}};
 const t=liveText({date:'2026-09-04',cutoff:17,label:'Augusto',rows:[row]});
 assert.ok(t.includes('ACTIVACIÓN INICIAL · 1/3 mensajes'));
 assert.ok(t.includes('Completar 3 contactos útiles'));
 assert.ok(!t.includes('A TIEMPO · 0 min'));
});
test('0.13.6 three activation touches complete first-day rule',()=>{
 const c={id:'x',contactName:'....',owner:'Augusto',adId:'1',sourceChannel:'meta'};
 const msgs=[
  {id:'ad',actor:'client',text:'CTA',timestamp:'2026-09-03T18:21:05-03:00'},
  {id:'bot',actor:'bot',text:'Pregunta',timestamp:'2026-09-03T18:21:06-03:00'},
  {id:'h1',actor:'human',user:'Augusto',text:'1',timestamp:'2026-09-04T09:04:15-03:00'},
  {id:'h2',actor:'human',user:'Augusto',text:'2',timestamp:'2026-09-04T12:00:00-03:00'},
  {id:'h3',actor:'human',user:'Augusto',text:'3',timestamp:'2026-09-04T16:00:00-03:00'}
 ];
 const r=analyzeConversation(c,msgs,range,30);
 assert.equal(r.leadActivationAttempts,3);
 assert.equal(r.leadActivationInsufficient,false);
 assert.equal(r.leadActivationComplete,true);
 assert.equal(r.passiveFollowUpCadenceDays,'7-10');
});
