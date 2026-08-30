const {normalizeConversation,normalizeMessage}=require('../core/normalizers');
class InboxAdapter{
  constructor(db,config){this.db=db;this.config=config}
  async listChangedConversations({since,limit}){
    const max=Math.max(1,Number(limit||this.config.incremental.max_conversations_per_run||250));
    const base=this.db.collection('conversations');
    // CORE/Bandeja update `updatedAt` not only on messages but also on manual-read and CRM-link changes.
    // Reading by updatedAt therefore observes the same operational state without scanning history.
    try{
      let q=base.orderBy('updatedAt','asc');
      if(since)q=q.where('updatedAt','>=',since);
      const s=await q.limit(max).get();
      return s.docs.map(d=>normalizeConversation(d.id,d.data()));
    }catch(_){
      let q=base.orderBy('lastMessageAt','asc');
      if(since)q=q.where('lastMessageAt','>=',since);
      const s=await q.limit(max).get();
      return s.docs.map(d=>normalizeConversation(d.id,d.data()));
    }
  }
  async listConversationsInRange({from,to,limit=500}){
    const max=Math.max(1,Number(limit||500));
    let s;
    try{s=await this.db.collection('conversations').where('lastMessageAt','>=',from).where('lastMessageAt','<=',to).orderBy('lastMessageAt','asc').limit(max).get()}
    catch(_){s=await this.db.collection('conversations').orderBy('lastMessageAt','asc').limit(max).get()}
    return s.docs.map(d=>normalizeConversation(d.id,d.data())).filter(c=>{const t=new Date(c.lastMessageAt||0).getTime();return Number.isFinite(t)&&t>=new Date(from).getTime()&&t<=new Date(to).getTime()})
  }
  async getConversation(id){const d=await this.db.collection('conversations').doc(String(id)).get();return d.exists?normalizeConversation(d.id,d.data()):null}
  async getMessages(id,limit){const max=Math.max(1,Number(limit||500));let s;try{s=await this.db.collection(`conversations/${id}/messages`).orderBy('timestamp','asc').limit(max).get()}catch(_){s=await this.db.collection(`conversations/${id}/messages`).limit(max).get()}return s.docs.map(d=>normalizeMessage(d.id,d.data())).sort((a,b)=>new Date(a.timestamp||0)-new Date(b.timestamp||0))}
}
module.exports={InboxAdapter};
