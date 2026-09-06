const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.11.7 remote tick is routed through safety wrapper',()=>{
  const s=fs.readFileSync('src/http/app.js','utf8');
  assert.ok(s.includes("remoteService.automationTick({engine,now"));
  assert.ok(s.includes("/api/supervisor/automation/health"));
  assert.ok(s.includes("/api/supervisor/automation/pause"));
  assert.ok(s.includes("/api/supervisor/automation/resume"));
});

test('0.11.7 safety has lock, read caps, timeout and circuit breaker',()=>{
  const s=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
  assert.ok(s.includes("acquireRemoteLock('automation_tick_lock'"));
  assert.ok(s.includes("CONVERSATION_READ_CAP"));
  assert.ok(s.includes("DEAL_READ_CAP"));
  assert.ok(s.includes("HUNTER_READ_CAP"));
  assert.ok(s.includes("TICK_TIMEOUT"));
  assert.ok(s.includes("CIRCUIT_BREAKER"));
});

test('0.11.7 Firestore lock is transactional',()=>{
  const s=fs.readFileSync('src/persistence/supervisorStore.js','utf8');
  assert.ok(s.includes('async acquireRemoteLock'));
  assert.ok(s.includes('this.db.runTransaction'));
  assert.ok(s.includes('async releaseRemoteLock'));
});

test('0.11.7 UI exposes automation health and emergency pause',()=>{
  const s=fs.readFileSync('public/index.html','utf8');
  assert.ok(s.includes('Seguridad de automatización'));
  assert.ok(s.includes('pauseAutomation()'));
  assert.ok(s.includes('refreshAutomationHealth()'));
  assert.ok(s.includes('runAutomationNow()'));
});
