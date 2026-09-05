const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const {RemoteSupervisorService,normalizeSupervisorConfig}=require('../src/core/remoteSupervisor');
const {EmailAdapter}=require('../src/adapters/emailAdapter');

test('0.9.3 keeps independent Telegram/email destinations per supervisor config',()=>{
  const a=normalizeSupervisorConfig({name:'Sup A',telegramChatId:'100',emailTo:'a@example.com',sendTelegram:true,sendEmail:true,sellers:['augusto']});
  const b=normalizeSupervisorConfig({name:'Sup B',telegramChatId:'200',emailTo:'b@example.com',sendTelegram:true,sendEmail:true,sellers:['charo']});
  assert.equal(a.telegramChatId,'100'); assert.equal(b.telegramChatId,'200');
  assert.equal(a.emailTo,'a@example.com'); assert.equal(b.emailTo,'b@example.com');
  assert.notEqual(a.id,b.id);
});

test('seller directory comes from CRM users without requiring role field',async()=>{
  const crm={listUsers:async()=>[
    {id:'u1',name:'Augusto Vera',email:'avera@sentirecustomsbroker.com',active:true},
    {id:'u2',displayName:'Charo Otaran',email:'charo@sentirecustomsbroker.com',enabled:true},
    {id:'u3',name:'Inactivo',email:'off@example.com',active:false}
  ]};
  const store={listAllDeals:async()=>[]};
  const svc=new RemoteSupervisorService({store,crm,inbox:{},aiProvider:{},telegram:{},email:{}});
  const rows=await svc.listSellerOptions();
  assert.deepEqual(rows.map(x=>x.label),['Augusto Vera','Charo Otaran']);
  assert.equal(rows[0].source,'crm_users');
});

test('email adapter can send to supervisor-specific recipient',async()=>{
  let payload;
  const adapter=new EmailAdapter({EMAIL_SERVICE_URL:'https://mail.example',EMAIL_SYSTEM_TOKEN:'t',EMAIL_ACCOUNT_KEY:'a'},async(_url,opt)=>{payload=JSON.parse(opt.body);return{ok:true,json:async()=>({ok:true})}});
  const result=await adapter.send({to:'seller-report@example.com',subject:'x',bodyText:'y'});
  assert.equal(payload.to,'seller-report@example.com');
  assert.equal(result.to,'seller-report@example.com');
});

test('0.9.3 UI exposes CRM search and independent per-config channels',()=>{
  const html=fs.readFileSync('public/index.html','utf8');
  for(const x of ['Buscar vendedor por nombre o email','Duplicar actual','Chat ID de Telegram para este vendedor','Email de reporte de este vendedor','Recomendado:</b> crear una configuración por vendedor'])assert.ok(html.includes(x),x);
});
