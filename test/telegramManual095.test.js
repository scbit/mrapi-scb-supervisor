const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.9.5 UI supports manual chat IDs for seller, general and weekend',()=>{
  const html=fs.readFileSync('public/index.html','utf8');
  for(const x of ['Chat ID manual','generalChatManual','weekendChatManual','sellerChatManual'])assert.ok(html.includes(x),x);
  assert.ok(html.includes("(generalChatManual.value||generalChat.value||'').trim()"));
});
