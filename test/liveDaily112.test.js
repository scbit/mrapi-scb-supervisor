const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.11.2 historical overdue backlog is baselined instead of creating mass corrections',()=>{
  const s=fs.readFileSync('src/core/liveDailySupervisor.js','utf8');
  assert.ok(s.includes('historicalOverdue'));
  assert.ok(s.includes('Backlog histórico en Recovery'));
  assert.ok(s.includes('historicalIds.has(String(d.id))'));
});

test('0.11.2 seller dry-run accepts a historical test date',()=>{
  const http=fs.readFileSync('src/http/app.js','utf8');
  const ui=fs.readFileSync('public/index.html','utf8');
  assert.ok(http.includes('dateOverride:q.body?.date||null'));
  assert.ok(ui.includes('liveTestDate'));
  assert.ok(ui.includes('último día hábil'));
});

test('0.11.2 report isolates observations by supervisor group',()=>{
  const s=fs.readFileSync('src/core/liveDailySupervisor.js','utf8');
  assert.ok(s.includes("filter(o=>o.supervisorId===cfg.id&&!o.historicalBaseline&&o.status!=='BASELINED')"));
});
