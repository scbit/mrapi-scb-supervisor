const {normalizeConversation,normalizeMessage}=require('../core/normalizers');

function digits(v){return String(v||'').replace(/\D/g,'')}
function uniq(xs){return [...new Set((xs||[]).filter(Boolean).map(String))]}
function phoneVariants(v){const d=digits(v);return d?uniq([d,`+${d}`,`whatsapp:+${d}`,`whatsapp:${d}`]):[]}
function parseConversationId(id){
  const raw=String(id||'').replace(/^whatsapp:/i,'').replace(/\+/g,'').trim();
  const parts=raw.split(/__+|[_|]/g).map(digits).filter(Boolean);
  return{customer:parts[0]||'',line:parts[1]||''};
}
function customerOf(d={},id=''){return digits(d.waFrom||d.from||d.phone||d.customerPhone||d.contactPhone||'')||parseConversationId(id).customer}
function lineOf(d={},id=''){return digits(d.lineId||d.inboundTo||d.preferredLineId||d.requestedLineId||'')||parseConversationId(id).line}
function timeMs(v){const n=new Date(v||0).getTime();return Number.isFinite(n)?n:0}
function maxIso(values){let best=null,bestMs=0;for(const v of values||[]){const ms=timeMs(v);if(ms>=bestMs&&v){best=v;bestMs=ms}}return best}
function first(rows,key){for(const r of rows){const v=r?.[key];if(v!==undefined&&v!==null&&String(v).trim())return v}return null}

class InboxAdapter{
  constructor(db,config){this.db=db;this.config=config;this.groupCache=new Map()}

  _coalesceDocs(docs){
    const groups=new Map();
    for(const doc of docs||[]){
      const d=doc.data?doc.data():doc.data||{};const id=doc.id;const customer=customerOf(d,id),line=lineOf(d,id);
      const key=customer&&line?`${customer}__${line}`:`id:${id}`;
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push({id,data:d});
    }
    const out=[];
    for(const [key,rows0] of groups){
      const rows=rows0.sort((a,b)=>timeMs(b.data.lastMessageAt||b.data.updatedAt)-timeMs(a.data.lastMessageAt||a.data.updatedAt));
      const normalized=rows.map(x=>normalizeConversation(x.id,x.data));
      const latest=normalized[0];
      const merged={...latest};
      merged.id=latest.id;
      merged.relatedConversationIds=uniq(rows.flatMap(x=>[x.id,...(Array.isArray(x.data.relatedConversationIds)?x.data.relatedConversationIds:[]),...(Array.isArray(x.data.duplicateConversationIds)?x.data.duplicateConversationIds:[])]));
      merged.contactIds=uniq(normalized.flatMap(x=>x.contactIds||[x.contactId]));
      merged.dealIds=uniq(normalized.flatMap(x=>x.dealIds||[x.dealId]));
      merged.contactId=merged.contactIds[0]||first(normalized,'contactId');
      merged.dealId=merged.dealIds[0]||first(normalized,'dealId');
      for(const k of ['contactName','phone','stage','sourceChannel','sourceOrigin','adTitle','adText','adId','adLine','owner'])merged[k]=first(normalized,k)||merged[k]||null;
      merged.lastMessageAt=maxIso(normalized.map(x=>x.lastMessageAt));
      merged.sourceUpdatedAt=maxIso(normalized.map(x=>x.sourceUpdatedAt));
      merged.lastInboundAt=maxIso(normalized.flatMap(x=>[x.lastInboundAt,x.lastCustomerMessageAt]));
      merged.lastCustomerMessageAt=merged.lastInboundAt;
      merged.lastOutboundAt=maxIso(normalized.map(x=>x.lastOutboundAt));
      merged.lastHumanMessageAt=maxIso(normalized.map(x=>x.lastHumanMessageAt));
      merged.unreadCount=normalized.reduce((n,x)=>n+Number(x.unreadCount||0),0);
      merged.hasUnread=merged.unreadCount>0||normalized.some(x=>x.hasUnread===true);
      merged.conversationKey=key.startsWith('id:')?null:key;
      out.push(merged);
    }
    return out;
  }

  async _resolveGroup(id){
    const key=String(id);if(this.groupCache.has(key))return this.groupCache.get(key);
    const base=await this.db.collection('conversations').doc(key).get();
    if(!base.exists){const empty={ids:[key],docs:[],conversation:null};this.groupCache.set(key,empty);return empty}
    const seed=base.data()||{},customer=customerOf(seed,base.id),line=lineOf(seed,base.id),docs=new Map([[base.id,base]]);
    const hinted=uniq([...(Array.isArray(seed.relatedConversationIds)?seed.relatedConversationIds:[]),...(Array.isArray(seed.duplicateConversationIds)?seed.duplicateConversationIds:[])]).filter(x=>x!==base.id);
    for(const alias of hinted.slice(0,20)){try{const s=await this.db.collection('conversations').doc(alias).get();if(s.exists)docs.set(s.id,s)}catch(_){}}
    if(customer&&line){
      const variants=phoneVariants(customer).slice(0,10);
      for(const field of ['waFrom','customerPhone','phone','from','contactPhone']){
        try{
          const q=await this.db.collection('conversations').where(field,'in',variants).limit(30).get();
          for(const doc of q.docs){const d=doc.data()||{};if(customerOf(d,doc.id)===customer&&lineOf(d,doc.id)===line)docs.set(doc.id,doc)}
        }catch(_){/* legacy fields/indexes are optional */}
      }
    }
    const conversation=this._coalesceDocs([...docs.values()])[0]||normalizeConversation(base.id,seed);
    conversation.id=key; // keep public/source id stable for HUB links and stored cases
    conversation.relatedConversationIds=uniq([key,...docs.keys()]);
    const result={ids:conversation.relatedConversationIds,docs:[...docs.values()],conversation};
    for(const alias of result.ids)this.groupCache.set(String(alias),result);
    return result;
  }

  async listChangedConversations({since,limit}){
    const max=Math.max(1,Number(limit||this.config.incremental.max_conversations_per_run||250));
    const base=this.db.collection('conversations');let s;
    try{let q=base.orderBy('updatedAt','asc');if(since)q=q.where('updatedAt','>=',since);s=await q.limit(max).get()}
    catch(_){let q=base.orderBy('lastMessageAt','asc');if(since)q=q.where('lastMessageAt','>=',since);s=await q.limit(max).get()}
    return this._coalesceDocs(s.docs);
  }

  async listConversationsInRange({from,to,limit=500,owner=null}){
    const max=Math.max(1,Number(limit||500)),ownerKey=String(owner||'').trim().toLowerCase();let s;
    // Hub v1.5.76 filters owners at source. Do the same here so a busy tenant
    // cannot consume the global limit before the requested seller/office is seen.
    if(ownerKey){
      try{
        s=await this.db.collection('conversations')
          .where('ownerEmail','==',ownerKey)
          .where('lastMessageAt','>=',from)
          .where('lastMessageAt','<=',to)
          .orderBy('lastMessageAt','asc')
          .limit(max).get();
        return this._coalesceDocs(s.docs).filter(c=>String(c.owner||'').trim().toLowerCase()===ownerKey&&(()=>{const t=timeMs(c.lastMessageAt);return Number.isFinite(t)&&t>=timeMs(from)&&t<=timeMs(to)})());
      }catch(_){
        // Keep compatibility with legacy datasets/indexes below.
      }
    }
    try{s=await this.db.collection('conversations').where('lastMessageAt','>=',from).where('lastMessageAt','<=',to).orderBy('lastMessageAt','asc').limit(max).get()}
    catch(_){s=await this.db.collection('conversations').orderBy('lastMessageAt','asc').limit(max).get()}
    return this._coalesceDocs(s.docs).filter(c=>{const t=timeMs(c.lastMessageAt);return Number.isFinite(t)&&t>=timeMs(from)&&t<=timeMs(to)&&(!ownerKey||String(c.owner||'').trim().toLowerCase()===ownerKey)})
  }

  async getConversation(id){return (await this._resolveGroup(id)).conversation}

  async getMessages(id,limit){
    const max=Math.max(1,Number(limit||500)),group=await this._resolveGroup(id),all=[];
    for(const conversationId of group.ids.slice(0,10)){
      let s;
      try{s=await this.db.collection(`conversations/${conversationId}/messages`).orderBy('timestamp','desc').limit(max).get()}
      catch(_){try{s=await this.db.collection(`conversations/${conversationId}/messages`).orderBy('timestamp','asc').limit(max).get()}catch(__){s=await this.db.collection(`conversations/${conversationId}/messages`).limit(max).get()}}
      for(const d of s.docs){const raw=d.data()||{},m=normalizeMessage(d.id,raw);m.conversationId=conversationId;m.messageSid=String(raw.messageSid||raw.sid||m.messageSid||'')||null;all.push(m)}
    }
    const by=new Map();
    for(const m of all){const k=m.messageSid||`${m.conversationId}:${m.id}`,prev=by.get(k);if(!prev||timeMs(prev.timestamp)<=timeMs(m.timestamp))by.set(k,m)}
    return [...by.values()].sort((a,b)=>timeMs(a.timestamp)-timeMs(b.timestamp)).slice(-max);
  }
}
module.exports={InboxAdapter,customerOf,lineOf};
