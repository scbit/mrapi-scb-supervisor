const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.13.21 UI exposes automatic Telegram DRY_RUN LIVE control',()=>{
  const s=fs.readFileSync('public/index.html','utf8');
  assert.ok(s.includes('Telegram automático'));
  assert.ok(s.includes('id="autoTelegramMode"'));
  assert.ok(s.includes('DRY_RUN · no enviar automáticamente'));
  assert.ok(s.includes('LIVE · enviar automáticamente'));
});

test('0.13.21 saves deliveryMode',()=>{
  const s=fs.readFileSync('public/index.html','utf8');
  assert.ok(s.includes('liveDaily:{deliveryMode:mode}'));
  assert.ok(s.includes('ENVÍOS AUTOMÁTICOS REALES'));
});

test('0.13.21 scheduler gates actual Telegram by LIVE',()=>{
  const s=fs.readFileSync('src/http/app.js','utf8');
  assert.ok(s.includes("const automaticSend=requestedSend&&deliveryMode==='LIVE'"));
  assert.ok(s.includes('runProductAutomation({now,send:automaticSend})'));
});

test('0.13.21 dedicated SUPER scheduler respects DRY_RUN',()=>{
  const s=fs.readFileSync('src/http/app.js','utf8');
  assert.ok(s.includes("reason:'TELEGRAM_DRY_RUN'"));
});

test('0.13.21 manual explicit sends remain independent',()=>{
  const s=fs.readFileSync('src/http/app.js','utf8');
  assert.ok(s.includes("if(q.body?.send===true){const chatId=await sellerChatId"));
  assert.ok(s.includes("if(q.body?.send===true){const chatId=await superSupervisorChatId"));
  assert.ok(s.includes("if(q.body?.send===true){const chatId=await closingChatId"));
});
