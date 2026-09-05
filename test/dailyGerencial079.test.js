const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const {analyzeDailyConversation,businessRange,telegramText,emailHtml}=require('../src/core/dailyGerencial');

const cfg={business_hours:{start:'09:00',end:'17:00'}};

test('daily gerencial counts normal human response and late minutes',()=>{
  const range=businessRange('2026-08-28',cfg);
  const row=analyzeDailyConversation({id:'c1',owner:'seller@scb.com'},[
    {timestamp:'2026-08-28T10:00:00-03:00',actor:'client',text:'hola'},
    {timestamp:'2026-08-28T10:45:00-03:00',actor:'human',user:'seller@scb.com',text:'respuesta'}
  ],range,30);
  assert.equal(row.humanResponded,true);
  assert.equal(row.noHumanResponse,false);
  assert.equal(row.lateCount,1);
  assert.equal(row.avgResponseMinutes,45);
});

test('daily gerencial applies closing grace like legacy supervisor',()=>{
  const range=businessRange('2026-08-28',cfg);
  const row=analyzeDailyConversation({id:'c2'},[
    {timestamp:'2026-08-28T16:50:00-03:00',actor:'client',text:'consulta'}
  ],range,30);
  assert.equal(row.businessCloseGrace,true);
  assert.equal(row.noHumanResponse,false);
});

test('daily gerencial recognizes after-hours human response',()=>{
  const range=businessRange('2026-08-28',cfg);
  const row=analyzeDailyConversation({id:'c3'},[
    {timestamp:'2026-08-28T16:10:00-03:00',actor:'client',text:'consulta'},
    {timestamp:'2026-08-28T17:20:00-03:00',actor:'human',user:'seller@scb.com',text:'respuesta'}
  ],range,30);
  assert.equal(row.humanResponded,true);
  assert.equal(row.respondedOutsideBusinessHours,true);
  assert.equal(row.lateCount,1);
});

test('daily report renderers separate Telegram text and Outlook HTML',()=>{
  const report={date:'2026-08-28',businessHours:'09:00–17:00',lateMinutes:30,attention:{clientChats:10,humanResponded:8,noHumanResponse:2,botOnly:1,late:3,afterHours:1,avgResponseMinutes:22},portfolio:{total:100,upToDate:50,overdue:40,noDueDate:10},hunter:{total:12,sellers:3},events:{HORNO:2,GANADO:1,GANADO_FROM_AD:1},bySeller:[{label:'Augusto Vera',clientChats:4,noHumanResponse:1,late:2,avgResponseMinutes:20}],aiQuality:{status:'PENDIENTE',note:'Sin IA'}};
  const text=telegramText(report),html=emailHtml(report);
  assert.match(text,/CIERRE GERENCIAL/);
  assert.match(text,/CALIDAD COMERCIAL/);
  assert.match(html,/role="presentation"/);
  assert.match(html,/RENDIMIENTO POR VENDEDOR/);
  assert.notEqual(text,html);
});

test('0.7.9 UI exposes daily gerencial manual controls',()=>{
  const html=fs.readFileSync('public/index.html','utf8');
  for(const s of ['Reporte Diario Gerencial V3','Ejecutar supervisor diario','Ver Diario','Enviar Diario a Telegram','Enviar Diario por Email','Enviar Diario Telegram + Email'])assert.ok(html.includes(s),s);
  for(const ep of ['/api/supervisor/daily/start','/api/supervisor/daily/process','/api/supervisor/daily/send/telegram','/api/supervisor/daily/send/email','/api/supervisor/daily/send/all'])assert.ok(html.includes(ep),ep);
});
