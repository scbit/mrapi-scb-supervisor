const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('0.13.31 manual UI forces fresh analysis instead of stale Daily cache',()=>{
  const ui=fs.readFileSync('public/index.html','utf8');
  assert.match(ui,/date:body\.date,cutoff:body\.cutoff,refresh:true,sellerKey:body\.sellerKey\|\|null/);
  assert.match(ui,/date,cutoff,refresh:true,sellerKey/);
  assert.match(ui,/v0\.13\.31/);
});

test('0.13.31 refresh bypasses per-conversation AI cache',()=>{
  const app=fs.readFileSync('src/http/app.js','utf8');
  assert.match(app,/forceAi:q\.body\?\.refresh===true/);
  assert.match(app,/guide_v1_product_context_v2_fresh/);
});

test('0.13.31 manual service invalidates obsolete report namespace',()=>{
  const svc=fs.readFileSync('src/core/manualSupervision.js','utf8');
  assert.match(svc,/guide_v1_product_context_v2_fresh/);
  assert.doesNotMatch(svc,/guide_v1_product_context_v1\$\{seller\}/);
});
