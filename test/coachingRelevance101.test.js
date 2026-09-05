const test=require('node:test');
const assert=require('node:assert/strict');
const {RemoteSupervisorService}=require('../src/core/remoteSupervisor');

function mockStore(states){
  const actions=[];
  return{
    actions,
    getSupervisionSettings:async()=>({coaching:{enabled:true,responseWaitingMinutes:15,maxAiReviewsPerSellerTick:0}}),
    listRemoteSupervisors:async()=>[],
    listAllDeals:async()=>[],
    listConversationStates:async()=>states,
    listSupervisionActionsForSellers:async()=>actions,
    findOpenSupervisionAction:async()=>null,
    countActionRecurrence:async()=>0,
    saveSupervisionAction:async(id,data)=>actions.push({...data,id}),
    listOpenSupervisionActions:async()=>[],
    getRemoteCheckpoint:async()=>null,
    saveRemoteCheckpoint:async()=>{},
    saveRemoteReport:async()=>{},
    getRemoteSupervisor:async()=>({id:'seller_group_augusto',name:'Agente AMBA Augusto Vera',sellerLabel:'Agente AMBA Augusto Vera',sellers:['avera@sentirecustomsbroker.com'],frequencyMinutes:30,startTime:'09:00',endTime:'17:00',lookbackMinutes:45})
  };
}

test('stale historical waits do not create new RESPOND corrections',async()=>{
  const now=new Date('2026-09-05T19:30:00-03:00');
  const states=[
    {id:'old',currentWaiting:true,metrics:{owner:'avera@sentirecustomsbroker.com',waitingForHuman:true,waitingMinutes:1348,waitingSince:'2026-09-04T21:02:00-03:00',lastCustomerMessageAt:'2026-09-04T21:02:00-03:00'}},
    {id:'recent',currentWaiting:true,metrics:{owner:'avera@sentirecustomsbroker.com',waitingForHuman:true,waitingMinutes:49,waitingSince:'2026-09-05T18:41:00-03:00',lastCustomerMessageAt:'2026-09-05T18:41:00-03:00'}}
  ];
  const store=mockStore(states);
  const svc=new RemoteSupervisorService({store,crm:{listUsers:async()=>[]},inbox:{},aiProvider:{},telegram:{}});
  const out=await svc.detectAutomaticActionsForSupervisor({id:'seller_group_augusto',sellers:['avera@sentirecustomsbroker.com'],sellerLabel:'Agente AMBA Augusto Vera',frequencyMinutes:30},{now});
  assert.equal(out.created.length,1);
  assert.equal(out.created[0].conversationId,'recent');
});

test('seller report excludes stale waiting items',async()=>{
  const now=new Date('2026-09-05T19:30:00-03:00');
  const states=[
    {id:'old',currentWaiting:true,snapshot:{contactName:'Viejo'},metrics:{owner:'avera@sentirecustomsbroker.com',waitingForHuman:true,lastCustomerMessageAt:'2026-09-04T21:02:00-03:00'}},
    {id:'recent',currentWaiting:true,snapshot:{contactName:'Cliente Reciente'},metrics:{owner:'avera@sentirecustomsbroker.com',waitingForHuman:true,lastCustomerMessageAt:'2026-09-05T18:41:00-03:00'}}
  ];
  const store=mockStore(states);
  const svc=new RemoteSupervisorService({store,crm:{},inbox:{},aiProvider:{},telegram:{}});
  const report=await svc.buildSupervisorReport('seller_group_augusto',{now});
  assert.ok(report.text.includes('Cliente Reciente'));
  assert.equal(report.text.includes('Viejo'),false);
  assert.ok(report.text.includes('Agente AMBA Augusto Vera'));
});
