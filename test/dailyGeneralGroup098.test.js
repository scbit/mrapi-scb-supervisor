const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.9.8 UI exposes Daily send to General group',()=>{
  const html=fs.readFileSync('public/index.html','utf8');
  assert.ok(html.includes('Enviar Diario al Grupo General'));
  assert.ok(html.includes('/api/supervisor/daily/send/general-group'));
});

test('0.9.8 backend resolves saved General group for Daily',()=>{
  const app=fs.readFileSync('src/http/app.js','utf8');
  assert.ok(app.includes("setup.settings?.weekday?.generalChatId"));
  assert.ok(app.includes("GENERAL_TELEGRAM_CHAT_REQUIRED"));
  assert.ok(app.includes("sendDailyTelegram(report,chatId)"));
});
