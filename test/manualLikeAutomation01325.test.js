const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.13.25 live auto uses seller-specific manual-like bases',()=>{
  const s=fs.readFileSync('src/http/app.js','utf8');
  const a=s.indexOf('async function runApprovedLiveAuto');
  const b=s.indexOf('async function runApprovedSuperAuto',a);
  const block=s.slice(a,b);
  assert.ok(block.includes('manualLikeSellerBase'));
  assert.ok(block.includes('liveSellerFromBase'));
  assert.equal(block.includes('manualSupervisionService.base(p.date,cutoff,false,null)'),false);
  assert.ok(block.includes("execution:'MANUAL_LIKE'"));
});

test('0.13.25 automatic seller work is concurrency bounded',()=>{
  const s=fs.readFileSync('src/http/app.js','utf8');
  assert.ok(s.includes('async function mapLimited'));
  assert.ok(s.includes('mapLimited(groups,3'));
});

test('0.13.25 SUPER and close can render from seller-combined cached base',()=>{
  const app=fs.readFileSync('src/http/app.js','utf8');
  const manual=fs.readFileSync('src/core/manualSupervision.js','utf8');
  assert.ok(app.includes('manualLikeCombinedBase'));
  assert.ok(app.includes('superSupervisorFromBase'));
  assert.ok(app.includes('closingFromBase'));
  assert.ok(manual.includes('async superSupervisorFromBase'));
  assert.ok(manual.includes('async closingFromBase'));
});

test('0.13.25 keeps automatic AI non-forced and schedulers split',()=>{
  const s=fs.readFileSync('src/http/app.js','utf8');
  assert.ok(s.includes('manualSupervisionService.base(date,cutoff,false,sellerKey)'));
  assert.ok(s.includes("/api/supervisor/remote/tick"));
  assert.ok(s.includes("/api/supervisor/sync/tick"));
});
