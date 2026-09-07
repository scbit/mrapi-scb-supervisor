const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.13.24 report clock does not call source sync',()=>{
  const s=fs.readFileSync('src/http/app.js','utf8');
  const a=s.indexOf("app.post('/api/supervisor/remote/tick'");
  const b=s.indexOf("app.post('/api/supervisor/sync/tick'",a);
  const block=s.slice(a,b);
  assert.ok(block.includes("mode:'REPORT_CLOCK'"));
  assert.ok(block.includes('runProductAutomation({now,send:automaticSend})'));
  assert.equal(block.includes('automationTick({'),false);
  assert.equal(block.includes('engine.run('),false);
});

test('0.13.24 sync clock never sends Telegram or product reports',()=>{
  const s=fs.readFileSync('src/http/app.js','utf8');
  const a=s.indexOf("app.post('/api/supervisor/sync/tick'");
  const b=s.indexOf("app.post(",a+20);
  const block=s.slice(a,b<0?s.length:b);
  assert.ok(block.includes("mode:'SYNC_TICK'"));
  assert.ok(block.includes('send:false'));
  assert.ok(block.includes('runLegacy:false'));
  assert.equal(block.includes('runProductAutomation'),false);
  assert.equal(block.includes('telegram.send'),false);
});

test('0.13.24 report clock preserves Telegram LIVE gate',()=>{
  const s=fs.readFileSync('src/http/app.js','utf8');
  const a=s.indexOf("app.post('/api/supervisor/remote/tick'");
  const b=s.indexOf("app.post('/api/supervisor/sync/tick'",a);
  const block=s.slice(a,b);
  assert.ok(block.includes("deliveryMode==='LIVE'"));
  assert.ok(block.includes('automaticSend=requestedSend&&'));
});

test('0.13.24 keeps all manual endpoints intact',()=>{
  const s=fs.readFileSync('src/http/app.js','utf8');
  for(const route of ['/api/supervisor/manual/start','/api/supervisor/manual/process','/api/supervisor/manual/live','/api/supervisor/manual/super','/api/supervisor/manual/close']) assert.ok(s.includes(route),route);
});
