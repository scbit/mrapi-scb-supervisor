const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const {RemoteSupervisorService}=require('../src/core/remoteSupervisor');
const {TelegramAdapter}=require('../src/adapters/telegramAdapter');

test('CRM/HUB seller directory keeps all active CRM users and owner fallback',async()=>{
  const crm={listUsers:async()=>[
    {id:'1',name:'Augusto Vera',email:'avera@sentirecustomsbroker.com',active:true},
    {id:'2',name:'Charo Otaran',email:'charo@sentirecustomsbroker.com',enabled:true},
    {id:'3',name:'Off',email:'off@example.com',active:false}
  ]};
  const store={listAllDeals:async()=>[{owner:'Jonathan Gonzalez'}]};
  const svc=new RemoteSupervisorService({store,crm,inbox:{},aiProvider:{},telegram:{}});
  const rows=await svc.listSellerOptions();
  assert.equal(rows.some(x=>x.label==='Augusto Vera'),true);
  assert.equal(rows.some(x=>x.label==='Charo Otaran'),true);
  assert.equal(rows.some(x=>x.label==='Jonathan Gonzalez'),true);
  assert.equal(rows.some(x=>x.label==='Off'),false);
});

test('network setup supports one Telegram group per seller plus general/weekend destinations',async()=>{
  const saved={};
  const store={
    getSupervisionSettings:async()=>null,saveSupervisionSettings:async x=>{saved.settings=x},
    getRemoteSupervisor:async()=>null,saveRemoteSupervisor:async(id,x)=>{(saved.groups||(saved.groups=[])).push({id,...x})},
    listRemoteSupervisors:async()=>[],listAllDeals:async()=>[]
  };
  const svc=new RemoteSupervisorService({store,crm:{listUsers:async()=>[]},inbox:{},aiProvider:{},telegram:{}});
  const out=await svc.saveNetworkSetup({settings:{weekday:{generalChatId:'-1001'},weekend:{chatId:'-1002',frequencyMinutes:120,startTime:'09:00',endTime:'24:00'}},sellerGroups:[
    {sellerId:'augusto',sellerLabel:'Augusto',telegramChatId:'-2001'},
    {sellerId:'charo',sellerLabel:'Charo',telegramChatId:'-2002'}
  ]});
  assert.equal(saved.groups.length,2);
  assert.equal(saved.groups[0].telegramChatId,'-2001');
  assert.equal(saved.groups[1].telegramChatId,'-2002');
  assert.equal(out.settings.weekday.generalChatId,'-1001');
  assert.equal(out.settings.weekend.chatId,'-1002');
});

test('Telegram adapter detects group chats from Bot API updates',async()=>{
  const a=new TelegramAdapter({TELEGRAM_BOT_TOKEN:'x',TELEGRAM_CHAT_ID:'1'},async()=>({ok:true,json:async()=>({ok:true,result:[
    {update_id:1,message:{chat:{id:-10077,title:'Supervisor Augusto',type:'supergroup'}}},
    {update_id:2,message:{chat:{id:-10088,title:'Supervisor General',type:'group'}}}
  ]})}));
  const rows=await a.listRecentChats();
  assert.deepEqual(rows.map(x=>x.chatId),['-10077','-10088']);
});

test('0.9.4 UI exposes seller groups, general group and weekend guard without old manual supervisor form',()=>{
  const html=fs.readFileSync('public/index.html','utf8');
  for(const x of ['Un grupo por vendedor','Grupo general del día','Guardia sábado y domingo','Buscar vendedor por nombre o email','Detectar grupos del bot'])assert.ok(html.includes(x),x);
  assert.equal(html.includes('Crear corrección puntual'),false);
  assert.equal(html.includes('conversationId'),false);
});
