const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.9.9 Daily UI lets user choose Telegram group',()=>{
  const html=fs.readFileSync('public/index.html','utf8');
  for(const x of ['dailyTelegramGroup','dailyTelegramChatManual','Cargar grupos','Enviar Diario al grupo elegido']) assert.ok(html.includes(x),x);
});

test('0.9.9 sends selected Daily group chatId to backend',()=>{
  const html=fs.readFileSync('public/index.html','utf8');
  assert.ok(html.includes("const base={date:dailyDateEl?.value||undefined,chatId}"));
  assert.ok(html.includes("/api/supervisor/daily/send/general-group"));
});
