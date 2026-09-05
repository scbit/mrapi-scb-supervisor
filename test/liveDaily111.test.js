const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.11.1 testSellerGroup does not shadow id helper',()=>{
  const s=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
  const start=s.indexOf('async testSellerGroup');
  const end=s.indexOf('async testGeneral',start);
  const block=s.slice(start,end);
  assert.ok(block.includes('const supervisorDocId='));
  assert.ok(block.includes("id:id('live_daily_report')"));
  assert.equal(block.includes("const id='seller_group__'"),false);
});
