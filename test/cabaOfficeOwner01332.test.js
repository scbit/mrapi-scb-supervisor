const test=require('node:test');
const assert=require('node:assert/strict');
const {ManualSupervisionService}=require('../src/core/manualSupervision');

function store(){
  const saved=[];
  return {
    saved,
    async listLiveDailyReports(){return[]},
    async listLiveDailyObservationsForSellers(){return[]},
    async saveLiveDailyReport(id,r){saved.push(r)},
  };
}

test('Oficina CABA keeps rows when human seller differs from conversation owner', async()=>{
  const st=store();
  const svc=new ManualSupervisionService({store:st});
  const base={rows:[{
    conversationId:'c1',
    owner:'oficina.caba@sentirecustomsbroker.com',
    scopeOwner:'oficina.caba@sentirecustomsbroker.com',
    seller:'augusto@sentirecustomsbroker.com',
    contactName:'Cliente',
    messagesInWindow:2,inboundCount:1,humanCount:1,humanResponded:true,
    lateCount:0,maxHumanResponseMinutes:4,
    commercialAdvance:true,goodCommercialResponse:true,
    ai:{commercial_advance:true,commercial_advance_type:'MODE_RECOMMENDATION',concrete_next_step:true,commercial_advance_reason:'Avance concreto'}
  }]};
  const r=await svc.liveSellerFromBase({base,date:'2026-09-23',cutoff:16,sellerKey:'oficina.caba@sentirecustomsbroker.com',sellerLabel:'Oficina CABA'});
  assert.equal(r.metrics.visibleChats,1);
  assert.equal(r.cases.length,1);
  assert.equal(r.cases[0].seller,'augusto@sentirecustomsbroker.com');
});
