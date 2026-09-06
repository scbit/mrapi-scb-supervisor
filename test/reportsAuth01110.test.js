const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.11.10 reports page reuses main supervisor token key',()=>{
  const s=fs.readFileSync('public/reports.html','utf8');
  assert.ok(s.includes("localStorage.getItem('supervisor_api_token')"));
  assert.ok(s.includes("localStorage.setItem('supervisor_api_token'"));
  assert.equal(s.includes("localStorage.getItem('supervisorToken')"),false);
});
