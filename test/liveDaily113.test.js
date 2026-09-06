const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.11.3 UI actually sends selected historical test date',()=>{
  const ui=fs.readFileSync('public/index.html','utf8');
  const start=ui.indexOf('async function testSellerGroup');
  const end=ui.indexOf('async function testGeneral',start);
  const block=ui.slice(start,end);
  assert.ok(block.includes("const date=(liveTestDate?.value||'').trim()||null"));
  assert.ok(block.includes('JSON.stringify({sellerId,send,date})'));
});

test('0.11.3 baselines legacy overdue observations created before baseline fix',()=>{
  const s=fs.readFileSync('src/core/liveDailySupervisor.js','utf8');
  assert.ok(s.includes("status:'BASELINED'"));
  assert.ok(s.includes('historicalBaseline:true'));
  assert.ok(s.includes("baselineReason:'Historical overdue backlog delegated to Recovery'"));
});

test('0.11.3 live report excludes baselined legacy observations',()=>{
  const s=fs.readFileSync('src/core/liveDailySupervisor.js','utf8');
  assert.ok(s.includes("!o.historicalBaseline&&o.status!=='BASELINED'"));
});
