const test=require('node:test');
const assert=require('node:assert/strict');
const {hubUrl}=require('../src/core/dailyGerencial');
const {publicHubConversationId}=require('../src/adapters/inboxAdapter');

test('hubUrl uses new HUB inbox route',()=>{
  assert.equal(hubUrl('5491150978631__5491152738166'),'https://hub.sentirecustomsbroker.com/inbox?conversationId=5491150978631__5491152738166');
});

test('publicHubConversationId prefers legacy customer__line over synthetic wa id',()=>{
  assert.equal(publicHubConversationId(['wa_073b57fa979a4e93ee496161083fcfd66f27d339','5491150978631__5491152738166']),'5491150978631__5491152738166');
});

test('publicHubConversationId falls back to synthetic id when legacy alias is unavailable',()=>{
  assert.equal(publicHubConversationId(['wa_abc']),'wa_abc');
});
