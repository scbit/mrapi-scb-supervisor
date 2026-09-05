const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const {RemoteSupervisorService}=require('../src/core/remoteSupervisor');

function baseStore(states=[]){
  const actions=[];
  const checkpoints=new Map();
  return{
    actions,checkpoints,
    getSupervisionSettings:async()=>({coaching:{enabled:true,responseWaitingMinutes:15,maxAiReviewsPerSellerTick:3}}),
    listRemoteSupervisors:async()=>[],
    listAllDeals:async()=>[],
    listConversationStates:async()=>states,
    listSupervisionActionsForSellers:async()=>actions,
    getRemoteCheckpoint:async id=>checkpoints.get(id)||null,
    saveRemoteCheckpoint:async(id,data)=>checkpoints.set(id,data),
    findOpenSupervisionAction:async({seller,conversationId,actionType})=>actions.find(a=>a.seller===seller&&a.conversationId===conversationId&&a.actionType===actionType&&['PENDING','WAITING_FOR_ACTION'].includes(a.status))||null,
    countActionRecurrence:async({seller,actionType})=>actions.filter(a=>a.seller===seller&&a.actionType===actionType).length,
    saveSupervisionAction:async(id,data)=>{const i=actions.findIndex(a=>a.id===id);if(i>=0)actions[i]={...actions[i],...data};else actions.push({...data,id})},
    listOpenSupervisionActions:async()=>actions.filter(a=>['PENDING','WAITING_FOR_ACTION'].includes(a.status)),
    getRemoteSupervisor:async()=>null,
    saveRemoteReport:async()=>{}
  };
}

test('automatic coaching creates deterministic RESPOND correction when client waits',async()=>{
  const store=baseStore([{id:'c1',currentWaiting:true,metrics:{owner:'augusto@scb.com',waitingForHuman:true,waitingMinutes:22,waitingSince:'2026-09-05T10:00:00-03:00',waitingCustomerText:'Necesito avanzar',lastMessageAt:'2026-09-05T10:00:00-03:00'}}]);
  const svc=new RemoteSupervisorService({store,crm:{listUsers:async()=>[]},inbox:{},aiProvider:{},telegram:{}});
  const r=await svc.detectAutomaticActionsForSupervisor({id:'seller_group_augusto',sellers:['augusto@scb.com'],sellerLabel:'Augusto',frequencyMinutes:30},{now:new Date('2026-09-05T10:22:00-03:00')});
  assert.equal(r.created.length,1);
  assert.equal(r.created[0].actionType,'RESPOND');
  assert.equal(r.created[0].verificationMode,'DETERMINISTIC');
  assert.equal(r.created[0].sourceDetection,'WAITING_CLIENT');
});

test('automatic coaching uses AI only on a new seller reply and persists controlled correction',async()=>{
  const state={id:'c2',currentWaiting:false,metrics:{owner:'augusto@scb.com',lastSellerActivityAt:'2026-09-05T10:20:00-03:00',lastMessageAt:'2026-09-05T10:20:00-03:00'}};
  const store=baseStore([state]);
  let aiCalls=0;
  const inbox={
    getConversation:async()=>({id:'c2',owner:'augusto@scb.com',contactName:'Cliente'}),
    getMessages:async()=>[
      {id:'m1',actor:'client',timestamp:'2026-09-05T10:10:00-03:00',text:'Quiero importar para vender'},
      {id:'m2',actor:'human',timestamp:'2026-09-05T10:20:00-03:00',text:'Pasame peso y medidas'}
    ]
  };
  const ai={analyzeSupervisionNeed:async()=>{aiCalls++;return{requiresCorrection:true,actionType:'DISCOVERY',severity:'HIGH',reason:'Respondió operativo sin indagar negocio.',expectedBehavior:'Preguntar uso, volumen y recurrencia.',rubric:['pregunta contexto','pregunta volumen'],evidence:'Solo pidió peso y medidas.'}}};
  const svc=new RemoteSupervisorService({store,crm:{listUsers:async()=>[]},inbox,aiProvider:ai,telegram:{}});
  const cfg={id:'seller_group_augusto',sellers:['augusto@scb.com'],sellerLabel:'Augusto',frequencyMinutes:30};
  const r1=await svc.detectAutomaticActionsForSupervisor(cfg,{now:new Date('2026-09-05T10:25:00-03:00')});
  assert.equal(r1.created.length,1);
  assert.equal(r1.created[0].actionType,'DISCOVERY');
  assert.equal(r1.created[0].verificationMode,'AI');
  assert.equal(aiCalls,1);
  const r2=await svc.detectAutomaticActionsForSupervisor(cfg,{now:new Date('2026-09-05T10:30:00-03:00')});
  assert.equal(aiCalls,1,'same seller message must not be re-analysed');
  assert.equal(r2.created.length,0);
});

test('qualitative correction evaluates next seller intervention and closes VERIFIED',async()=>{
  const store=baseStore([]);
  const createdAt='2026-09-05T10:20:00-03:00';
  store.actions.push({id:'a1',seller:'augusto@scb.com',sellerKey:'augusto@scb.com',conversationId:'c3',actionType:'DISCOVERY',reason:'Faltó indagar',expectedBehavior:'Preguntar volumen',rubric:['pregunta volumen'],verificationMode:'AI',status:'WAITING_FOR_ACTION',createdAt});
  const inbox={
    getMessages:async()=>[
      {id:'m3',actor:'human',timestamp:'2026-09-05T10:25:00-03:00',text:'¿Qué cantidad pensás traer y es para reventa?'}
    ],
    getConversation:async()=>({id:'c3',contactName:'Cliente'})
  };
  const ai={verifyCorrection:async()=>({verified:true,score:95,reason:'Preguntó cantidad y objetivo comercial.',criteria:[{criterion:'pregunta volumen',met:true}]})};
  const svc=new RemoteSupervisorService({store,crm:{},inbox,aiProvider:ai,telegram:{}});
  const out=await svc.verifyPending();
  assert.equal(out[0].status,'VERIFIED');
  assert.equal(store.actions[0].status,'VERIFIED');
});

test('0.10.0 UI exposes automatic coaching controls',()=>{
  const html=fs.readFileSync('public/index.html','utf8');
  for(const x of ['Coaching automático','coachingEnabled','coachingWaiting','coachingAiMax','Analizar / Probar'])assert.ok(html.includes(x),x);
});
