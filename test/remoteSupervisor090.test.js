const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeSupervisorConfig,withinSchedule,RemoteSupervisorService,ACTION_TYPES}=require('../src/core/remoteSupervisor');

test('config soporta 09-17, pausa 12-13 y frecuencia UI',()=>{
  const c=normalizeSupervisorConfig({name:'Juan',sellers:['Augusto','Charo'],startTime:'09:00',endTime:'17:00',pauses:[{start:'12:00',end:'13:00'}],frequencyMinutes:30});
  assert.equal(c.startTime,'09:00');assert.equal(c.endTime,'17:00');assert.equal(c.frequencyMinutes,30);assert.deepEqual(c.sellers,['Augusto','Charo']);assert.deepEqual(c.pauses,[{start:'12:00',end:'13:00'}]);
});

test('schedule respeta pausa',()=>{
  const c=normalizeSupervisorConfig({timezone:'America/Argentina/Buenos_Aires',startTime:'09:00',endTime:'17:00',pauses:[{start:'12:00',end:'13:00'}]});
  assert.equal(withinSchedule(c,new Date('2026-09-04T14:30:00Z')).active,true); // 11:30 AR
  assert.equal(withinSchedule(c,new Date('2026-09-04T15:30:00Z')).reason,'pause'); // 12:30 AR
  assert.equal(withinSchedule(c,new Date('2026-09-04T20:30:00Z')).active,false); // 17:30 AR
});

test('catalogo de acciones es controlado',()=>{assert.deepEqual(ACTION_TYPES,['RESPOND','FOLLOW_UP','DISCOVERY','ADVISE','EXPLAIN_OPTIONS','DO_NOT_DISMISS','IMPROVE_RESPONSE','TRY_TO_CLOSE'])});

test('RESPOND se verifica con siguiente mensaje humano sin IA',async()=>{
  const saved=[];
  const store={findOpenSupervisionAction:async()=>null,countActionRecurrence:async()=>0,saveSupervisionAction:async(_id,x)=>saved.push(x)};
  const inbox={getMessages:async()=>[{id:'m1',actor:'client',timestamp:'2026-09-04T13:00:00Z',text:'hola'},{id:'m2',actor:'human',timestamp:'2026-09-04T13:10:00Z',text:'Hola, te ayudo'}],getConversation:async()=>({id:'c1'})};
  const svc=new RemoteSupervisorService({config:{},store,inbox,aiProvider:{verifyCorrection:async()=>{throw new Error('no debe usar IA')}},telegram:{}});
  const a=await svc.createAction({seller:'Augusto',conversationId:'c1',actionType:'RESPOND'});a.createdAt='2026-09-04T13:05:00Z';const v=await svc.verifyAction(a);assert.equal(v.status,'VERIFIED');assert.equal(v.verificationMode,'DETERMINISTIC');
});

test('DISCOVERY usa AI provider desacoplado y puede fallar',async()=>{
  const store={saveSupervisionAction:async()=>{}};
  const inbox={getMessages:async()=>[{id:'m2',actor:'human',timestamp:'2026-09-04T13:10:00Z',text:'dale cualquier cosa avisame'}],getConversation:async()=>({id:'c1',contactName:'Cliente'})};
  const ai={verifyCorrection:async({action})=>({verified:false,score:20,reason:'No indagó',criteria:action.rubric.map(x=>({criterion:x,met:false}))})};
  const svc=new RemoteSupervisorService({config:{},store,inbox,aiProvider:ai,telegram:{}});
  const a={id:'a1',seller:'Augusto',sellerKey:'augusto',conversationId:'c1',actionType:'DISCOVERY',reason:'Falta indagar',expectedBehavior:'Indagar negocio',rubric:['pregunta producto'],verificationMode:'AI',status:'WAITING_FOR_ACTION',createdAt:'2026-09-04T13:05:00Z',attempts:0};
  const v=await svc.verifyAction(a);assert.equal(v.status,'FAILED');assert.equal(v.verificationResult.reason,'No indagó');
});
