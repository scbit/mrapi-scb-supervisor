const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const {normalizeSupervisorConfig,scheduleMode,signalRank}=require('../src/core/remoteSupervisor');

test('0.9.2 weekday schedule supports selectable days and 09-17 pause 12-13',()=>{
  const cfg=normalizeSupervisorConfig({weekdays:['Mon','Tue','Wed','Thu','Fri'],startTime:'09:00',endTime:'17:00',pauses:[{start:'12:00',end:'13:00'}],weekend:{enabled:true,days:['Sat','Sun'],frequencyMinutes:120}});
  assert.equal(scheduleMode(cfg,new Date('2026-09-07T10:00:00-03:00')).mode,'weekday');
  assert.equal(scheduleMode(cfg,new Date('2026-09-07T12:30:00-03:00')).reason,'pause');
});
test('0.9.2 weekend guard is separate and routes to personal general telegram contract',()=>{
  const cfg=normalizeSupervisorConfig({weekend:{enabled:true,days:['Sat','Sun'],frequencyMinutes:120,minimumSignal:'MUY_INTERESANTE'}});
  const s=scheduleMode(cfg,new Date('2026-09-05T11:00:00-03:00'));
  assert.equal(s.mode,'weekend_guard'); assert.equal(cfg.weekend.destination,'GENERAL_PERSONAL_TELEGRAM'); assert.equal(cfg.weekend.alertOnly,true);
});
test('weekend opportunity scale is not CRM lead quality',()=>{
  assert.ok(signalRank('URGENTE')>signalRank('MUY_INTERESANTE')); assert.equal(signalRank('EXCELENTE'),0);
});
test('0.9.2 UI hides manual conversation correction entry and exposes days/weekend',()=>{
  const html=fs.readFileSync('public/index.html','utf8');
  for(const x of ['Guardia fin de semana','Días de supervisión normal','Destino fin de semana: solo tu Telegram personal','Cada 30 minutos'])assert.ok(html.includes(x),x);
  assert.equal(html.includes('placeholder="conversationId"'),false);
});
