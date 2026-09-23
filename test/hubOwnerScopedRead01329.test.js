const test=require('node:test');
const assert=require('node:assert/strict');
const {InboxAdapter}=require('../src/adapters/inboxAdapter');

function makeDoc(id,data){return{id,data:()=>data}}
function makeQuery(log,docs){
  return {
    where(field,op,value){log.push(['where',field,op,value]);return this},
    orderBy(field,dir){log.push(['orderBy',field,dir]);return this},
    limit(n){log.push(['limit',n]);return this},
    async get(){return{docs}}
  }
}

test('0.13.29 seller report scopes Firestore read by ownerEmail before global limit',async()=>{
  const log=[];
  const docs=[makeDoc('549111__549222',{ownerEmail:'oficina.caba@sentirecustomsbroker.com',waFrom:'549111',inboundTo:'549222',lastMessageAt:'2026-09-23T13:00:00.000Z'})];
  const db={collection(name){assert.equal(name,'conversations');return makeQuery(log,docs)}};
  const adapter=new InboxAdapter(db,{incremental:{max_conversations_per_run:250}});
  const rows=await adapter.listConversationsInRange({from:new Date('2026-09-23T03:00:00Z'),to:new Date('2026-09-24T02:59:59Z'),limit:500,owner:'OFICINA.CABA@SENTIRECUSTOMSBROKER.COM'});
  assert.equal(rows.length,1);
  assert.ok(log.some(x=>x[0]==='where'&&x[1]==='ownerEmail'&&x[2]==='=='&&x[3]==='oficina.caba@sentirecustomsbroker.com'));
});
