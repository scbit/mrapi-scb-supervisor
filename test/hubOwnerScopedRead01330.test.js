const test=require('node:test');
const assert=require('node:assert/strict');
const {InboxAdapter}=require('../src/adapters/inboxAdapter');

function makeDoc(id,data){return{id,data:()=>data}}
function fakeDb({ownerQueryThrows=false}={}){
  const log=[];
  const docs=[
    makeDoc('caba1',{ownerEmail:'oficina.caba@sentirecustomsbroker.com',waFrom:'549111',inboundTo:'549222',lastMessageAt:'2026-09-23T15:00:00.000Z'}),
    makeDoc('other1',{ownerEmail:'otro@sentirecustomsbroker.com',waFrom:'549333',inboundTo:'549222',lastMessageAt:'2026-09-23T14:00:00.000Z'})
  ];
  function query(state={filters:[],order:null,limit:null}){
    return{
      where(field,op,value){log.push(['where',field,op,value]);return query({...state,filters:[...state.filters,[field,op,value]]})},
      orderBy(field,dir){log.push(['orderBy',field,dir]);return query({...state,order:[field,dir]})},
      limit(n){log.push(['limit',n]);return query({...state,limit:n})},
      async get(){
        const hasOwner=state.filters.some(f=>f[0]==='ownerEmail');
        if(hasOwner&&ownerQueryThrows)throw new Error('FAILED_PRECONDITION: missing index');
        let rows=docs.slice();
        for(const [field,op,value] of state.filters){
          if(field==='ownerEmail'&&op==='==')rows=rows.filter(d=>d.data().ownerEmail===value);
          if(field==='lastMessageAt'&&op==='>=')rows=rows.filter(d=>new Date(d.data().lastMessageAt)>=new Date(value));
        }
        return{docs:rows.slice(0,state.limit||rows.length)};
      }
    }
  }
  return{db:{collection(){return query()}},log};
}

test('0.13.30 owner read mirrors Hub query: lower bound + DESC, no upper bound',async()=>{
  const {db,log}=fakeDb();const adapter=new InboxAdapter(db,{incremental:{}});
  const rows=await adapter.listConversationsInRange({from:new Date('2026-09-23T03:00:00Z'),to:new Date('2026-09-24T02:59:59Z'),limit:500,owner:'oficina.caba@sentirecustomsbroker.com'});
  assert.equal(rows.length,1);
  assert.ok(log.some(x=>x[0]==='orderBy'&&x[1]==='lastMessageAt'&&x[2]==='desc'));
  assert.equal(log.some(x=>x[0]==='where'&&x[1]==='lastMessageAt'&&x[2]==='<='),false);
});

test('0.13.30 missing owner composite index falls back to day read instead of false zero',async()=>{
  const {db}=fakeDb({ownerQueryThrows:true});const adapter=new InboxAdapter(db,{incremental:{}});
  const rows=await adapter.listConversationsInRange({from:new Date('2026-09-23T03:00:00Z'),to:new Date('2026-09-24T02:59:59Z'),limit:500,owner:'oficina.caba@sentirecustomsbroker.com'});
  assert.equal(rows.length,1);
  assert.equal(rows[0].owner,'oficina.caba@sentirecustomsbroker.com');
});
