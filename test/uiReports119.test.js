const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.11.9 hides legacy report blocks from main operations UI',()=>{
  const s=fs.readFileSync('public/index.html','utf8');
  assert.ok(s.includes('legacyGeneralReport'));
  assert.ok(s.includes('legacyDailyReport'));
  assert.ok(s.includes('.legacyHidden{display:none!important}'));
});

test('0.11.9 has reports archive page and APIs',()=>{
  const app=fs.readFileSync('src/http/app.js','utf8');
  const page=fs.readFileSync('public/reports.html','utf8');
  assert.ok(app.includes("app.get('/reports'"));
  assert.ok(app.includes('/api/supervisor/archive/reports'));
  assert.ok(app.includes('/api/supervisor/archive/incidents'));
  assert.ok(page.includes('Reportes e incidentes'));
});

test('0.11.9 scheduler health uses real heartbeat',()=>{
  const s=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
  assert.ok(s.includes("scheduler_heartbeat"));
  assert.ok(s.includes("'NOT_CONNECTED'"));
  assert.ok(s.includes("'ACTIVE'"));
  assert.ok(s.includes("'LATE'"));
});

test('0.11.9 scheduler calls identify source and critical incidents persist',()=>{
  const http=fs.readFileSync('src/http/app.js','utf8');
  const remote=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
  assert.ok(http.includes("source:q.body?.source==='scheduler'?'scheduler':'manual'"));
  assert.ok(remote.includes('saveCriticalSystemIncident'));
  assert.ok(remote.includes("'CIRCUIT_BREAKER'"));
});
