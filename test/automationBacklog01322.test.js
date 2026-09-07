const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.13.22 read caps are backlog warnings, not automatic pause',()=>{
  const s=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
  assert.ok(s.includes("const backlogWarnings=[hitConversationCap?'CONVERSATION_READ_CAP'"));
  assert.ok(s.includes("saveRemoteCheckpoint('automation_backlog_warning'"));
  assert.ok(s.includes('if(timedOut){'));
});

test('0.13.22 timeout remains fail closed',()=>{
  const s=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
  assert.ok(s.includes("autoPaused:true,pauseReason:'TICK_TIMEOUT'"));
  assert.ok(s.includes("reason:'SAFETY_LIMIT_REACHED'"));
});

test('0.13.22 successful tick persists warnings without pausing',()=>{
  const s=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
  assert.ok(s.includes('lastWarnings:backlogWarnings'));
  assert.ok(s.includes('consecutiveFailures:0,lastError:null'));
});

test('0.13.22 health exposes warnings and UI shows pause reason',()=>{
  const core=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
  const ui=fs.readFileSync('public/index.html','utf8');
  assert.ok(core.includes('lastWarnings:Array.isArray(health.lastWarnings)'));
  assert.ok(ui.includes('Motor pausado · motivo:'));
  assert.ok(ui.includes('continuará en el próximo tick'));
});
