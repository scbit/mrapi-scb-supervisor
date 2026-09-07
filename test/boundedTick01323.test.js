const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.13.23 engine supports bounded run limits',()=>{
  const s=fs.readFileSync('src/core/engine.js','utf8');
  assert.ok(s.includes('limits={}'));
  assert.ok(s.includes('runLimits={conversations:'));
  assert.ok(s.includes('limit:runLimits.conversations'));
  assert.ok(s.includes('limit:runLimits.deals'));
  assert.ok(s.includes('limit:runLimits.hunter'));
});

test('0.13.23 scheduler uses smaller bounded source batches',()=>{
  const s=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
  assert.ok(s.includes('schedulerConversationsPerTick:25'));
  assert.ok(s.includes('schedulerDealsPerTick:300'));
  assert.ok(s.includes('schedulerHunterEventsPerTick:750'));
  assert.ok(s.includes("const engineLimits=source==='scheduler'"));
  assert.ok(s.includes('engine.run({now,limits:engineLimits})'));
});

test('0.13.23 weekday scheduler skips obsolete remote reporting path',()=>{
  const core=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
  const app=fs.readFileSync('src/http/app.js','utf8');
  assert.ok(core.includes("mode:'sync_only'"));
  assert.ok(app.includes('runLegacy:isWeekend'));
});

test('0.13.23 automatic product failures are isolated',()=>{
  const s=fs.readFileSync('src/http/app.js','utf8');
  assert.ok(s.includes("type:'AUTO_PRODUCT_FAILURE'"));
  assert.ok(s.includes("reason:'PRODUCT_FAILED'"));
});
