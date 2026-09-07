const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.13.20 checkbox change does not reload stale saved settings',()=>{
  const s=fs.readFileSync('public/index.html','utf8');
  assert.ok(s.includes('function paintAutomationStates()'));
  assert.ok(s.includes("el.addEventListener('change',paintAutomationStates)"));
  assert.ok(!s.includes("el.addEventListener('change',renderAutomationControls)"));
});

test('0.13.20 saved backend values still render on setup load',()=>{
  const s=fs.readFileSync('public/index.html','utf8');
  assert.ok(s.includes('autoLive.checked=wd.liveAutoEnabled===true'));
  assert.ok(s.includes('autoSuper.checked=wd.superAutoEnabled===true'));
  assert.ok(s.includes('autoClose.checked=wd.closingAutoEnabled===true'));
  assert.ok(s.includes('renderAutomationControls();'));
});
