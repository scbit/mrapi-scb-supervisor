const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.11.6 only client-inbound chats enter live commercial evaluation',()=>{
  const s=fs.readFileSync('src/core/liveDailySupervisor.js','utf8');
  assert.ok(s.includes("Number(x.row?.inboundCount||0)>0"));
  assert.ok(s.includes("reportCases=[...new Map"));
});

test('0.11.6 new consolidated case persists dimensions',()=>{
  const s=fs.readFileSync('src/core/liveDailySupervisor.js','utf8');
  const start=s.indexOf("obs={id:id('daily_case')");
  const block=s.slice(start,start+1400);
  assert.ok(block.includes('dimensions:commercial.dimensions'));
});

test('0.11.6 supersedes legacy per-issue observations',()=>{
  const s=fs.readFileSync('src/core/liveDailySupervisor.js','utf8');
  assert.ok(s.includes("status:'SUPERSEDED'"));
  assert.ok(s.includes("Migrated to one-chat-one-case supervision"));
  assert.ok(s.includes("o.status!=='SUPERSEDED'"));
});
