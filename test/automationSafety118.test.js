const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.11.8 does not pre-pause based on configured Telegram destinations',()=>{
  const s=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
  assert.equal(s.includes('Configured destinations ${enabledGroups+1} exceed max ${maxTelegram}'),false);
  assert.equal(s.includes('const enabledGroups=setup.sellerGroups.filter'),false);
});

test('0.11.8 Telegram budget uses actual sends after tick',()=>{
  const s=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
  assert.ok(s.includes('const actualTelegramSends='));
  assert.ok(s.includes("pauseReason:'TELEGRAM_BUDGET_EXCEEDED'"));
  assert.ok(s.includes('Actual Telegram sends ${actualTelegramSends} exceeded max ${maxTelegram}'));
});

test('0.11.8 DRY_RUN cannot hit Telegram budget before processing',()=>{
  const s=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
  const tickPos=s.indexOf('const result=await this.tick({now,send});');
  const budgetPos=s.indexOf('Actual Telegram sends ${actualTelegramSends} exceeded max ${maxTelegram}');
  assert.ok(tickPos>=0 && budgetPos>tickPos);
});
