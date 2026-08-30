const test=require('node:test');
const assert=require('node:assert/strict');
const {detectMessageActor}=require('../src/core/normalizers');

test('detects legacy human type without explicit user',()=>{
  assert.equal(detectMessageActor({direction:'OUT',type:'human'}),'human');
});

test('detects human-template without explicit user',()=>{
  assert.equal(detectMessageActor({direction:'outbound',source:'human-template'}),'human');
});

test('detects manual template as human',()=>{
  assert.equal(detectMessageActor({direction:'OUT',source:'manual_template'}),'human');
});

test('keeps automated template as bot when no human marker',()=>{
  assert.equal(detectMessageActor({direction:'OUT',type:'template',source:'automation'}),'bot');
});

test('detects outbound with explicit human user',()=>{
  assert.equal(detectMessageActor({direction:'OUT',userEmail:'seller@example.com'}),'human');
});
