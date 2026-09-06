class SupervisorStore{constructor(db){this.db=db;this.c={conversations:'supervisor_v3_conversation_state',deals:'supervisor_v3_deal_state',hunter:'supervisor_v3_hunter_event_state',checkpoints:'supervisor_v3_checkpoints',runs:'supervisor_v3_runs',events:'supervisor_v3_events',reports:'supervisor_v3_reports',dailyReports:'supervisor_v3_daily_reports',dailyJobs:'supervisor_v3_daily_jobs',dailyItems:'supervisor_v3_daily_items',dailyReviews:'supervisor_v3_daily_reviews',remoteSupervisors:'supervisor_v3_remote_supervisors',supervisionActions:'supervisor_v3_supervision_actions',remoteReports:'supervisor_v3_remote_reports',remoteCheckpoints:'supervisor_v3_remote_checkpoints',liveDailyCases:'supervisor_v3_live_daily_cases',liveDailyObservations:'supervisor_v3_live_daily_observations',liveDailyReports:'supervisor_v3_live_daily_reports',liveDailyBaselines:'supervisor_v3_live_daily_baselines'}}
async getCheckpoint(id){const d=await this.db.collection(this.c.checkpoints).doc(id).get();return d.exists?d.data():null}async saveCheckpoint(id,data){await this.db.collection(this.c.checkpoints).doc(id).set({...data,updatedAt:new Date().toISOString()},{merge:true})}
async getConversationState(id){const d=await this.db.collection(this.c.conversations).doc(String(id)).get();return d.exists?{id:d.id,...d.data()}:null}async saveConversationState(id,data){await this.db.collection(this.c.conversations).doc(String(id)).set({...data,updatedAt:new Date().toISOString()},{merge:true})}
async listWaiting(limit=500){const s=await this.db.collection(this.c.conversations).where('currentWaiting','==',true).limit(limit).get();return s.docs.map(d=>({id:d.id,...d.data()}))}async listPending(limit=500){const rows=await this.listWaiting(limit);return rows.filter(x=>x.metrics?.pendingAssignment)}async listConversationStates(limit=5000){const s=await this.db.collection(this.c.conversations).limit(limit).get();return s.docs.map(d=>({id:d.id,...d.data()}))}
async getDealState(id){const d=await this.db.collection(this.c.deals).doc(String(id)).get();return d.exists?{id:d.id,...d.data()}:null}async saveDealState(id,data){await this.db.collection(this.c.deals).doc(String(id)).set({...data,updatedAt:new Date().toISOString()},{merge:true})}async listTrackedDeals(limit=10000){const s=await this.db.collection(this.c.deals).where('followUp.tracked','==',true).limit(limit).get();return s.docs.map(d=>({id:d.id,...d.data()}))}async listActiveDeals(limit=20000){const s=await this.db.collection(this.c.deals).where('portfolio.active','==',true).limit(limit).get();return s.docs.map(d=>({id:d.id,...d.data()}))}async listAllDeals(limit=20000){const s=await this.db.collection(this.c.deals).limit(limit).get();return s.docs.map(d=>({id:d.id,...d.data()}))}async setDealPortfolioBatch(rows=[]){for(let i=0;i<rows.length;i+=400){const batch=this.db.batch();for(const r of rows.slice(i,i+400)){const ref=this.db.collection(this.c.deals).doc(String(r.id));batch.set(ref,{portfolio:r.portfolio,updatedAt:new Date().toISOString()},{merge:true})}await batch.commit()}}
async getHunterState(id){const d=await this.db.collection(this.c.hunter).doc(String(id)).get();return d.exists?d.data():null}async saveHunterState(id,data){await this.db.collection(this.c.hunter).doc(String(id)).set({...data,updatedAt:new Date().toISOString()},{merge:true})}async listHunterDay(day,limit=10000){const s=await this.db.collection(this.c.hunter).where('day','==',day).limit(limit).get();return s.docs.map(d=>({id:d.id,...d.data()}))}
async listEventsRange(from,to,limit=1000){const s=await this.db.collection(this.c.events).where('occurredAt','>=',from).where('occurredAt','<=',to).limit(limit).get();return s.docs.map(d=>({id:d.id,...d.data()}))}
async saveEvent(event){const id=`${event.type}__${event.dealId}__${event.currentStage}`;const ref=this.db.collection(this.c.events).doc(id);const d=await ref.get();if(d.exists)return false;await ref.set({...event,id,createdAt:new Date().toISOString()});return true}async listEventsSince(since,limit=1000){const s=await this.db.collection(this.c.events).where('occurredAt','>=',since).limit(limit).get();return s.docs.map(d=>({id:d.id,...d.data()}))}
async startRun(id,data){await this.db.collection(this.c.runs).doc(id).set({...data,status:'RUNNING',startedAt:new Date().toISOString()})}async finishRun(id,data){await this.db.collection(this.c.runs).doc(id).set({...data,status:'COMPLETE',finishedAt:new Date().toISOString()},{merge:true})}async getLatestRun(){const s=await this.db.collection(this.c.runs).orderBy('startedAt','desc').limit(1).get();return s.empty?null:{id:s.docs[0].id,...s.docs[0].data()}}
async saveReport(id,data){await this.db.collection(this.c.reports).doc(id).set({...data,updatedAt:new Date().toISOString()},{merge:true})}async getLatestReport(){const s=await this.db.collection(this.c.reports).orderBy('generatedAt','desc').limit(1).get();return s.empty?null:{id:s.docs[0].id,...s.docs[0].data()}}

async saveDailyJob(id,data){await this.db.collection(this.c.dailyJobs).doc(String(id)).set({...data,updatedAt:new Date().toISOString()},{merge:true})}async getDailyJob(id){const d=await this.db.collection(this.c.dailyJobs).doc(String(id)).get();return d.exists?{id:d.id,...d.data()}:null}
async saveDailyItem(jobId,conversationId,data){const id=`${jobId}__${Buffer.from(String(conversationId)).toString('base64url').slice(0,160)}`;await this.db.collection(this.c.dailyItems).doc(id).set({jobId,conversationId,...data,updatedAt:new Date().toISOString()},{merge:true})}async listDailyItems(jobId,limit=1000){const s=await this.db.collection(this.c.dailyItems).where('jobId','==',String(jobId)).limit(limit).get();return s.docs.map(d=>({id:d.id,...d.data()}))}
async getDailyReview(date,conversationId){const id=`${date}__${Buffer.from(String(conversationId)).toString('base64url').slice(0,160)}`;const d=await this.db.collection(this.c.dailyReviews).doc(id).get();return d.exists?d.data().ai:null}async saveDailyReview(date,conversationId,ai){const id=`${date}__${Buffer.from(String(conversationId)).toString('base64url').slice(0,160)}`;await this.db.collection(this.c.dailyReviews).doc(id).set({date,conversationId,ai,updatedAt:new Date().toISOString()},{merge:true})}
async saveDailyReport(date,data){await this.db.collection(this.c.dailyReports).doc(String(date)).set({...data,updatedAt:new Date().toISOString()},{merge:true})}async getDailyReport(date){const d=await this.db.collection(this.c.dailyReports).doc(String(date)).get();return d.exists?{id:d.id,...d.data()}:null}async getLatestDailyReport(){const s=await this.db.collection(this.c.dailyReports).orderBy('generatedAt','desc').limit(1).get();return s.empty?null:{id:s.docs[0].id,...s.docs[0].data()}}
async saveRemoteSupervisor(id,data){await this.db.collection(this.c.remoteSupervisors).doc(String(id)).set({...data,id:String(id),updatedAt:new Date().toISOString()},{merge:true})}
async getRemoteSupervisor(id){const d=await this.db.collection(this.c.remoteSupervisors).doc(String(id)).get();return d.exists?{id:d.id,...d.data()}:null}
async listRemoteSupervisors(limit=100){const s=await this.db.collection(this.c.remoteSupervisors).limit(limit).get();return s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id)))}
async saveSupervisionAction(id,data){await this.db.collection(this.c.supervisionActions).doc(String(id)).set({...data,id:String(id),updatedAt:new Date().toISOString()},{merge:true})}
async getSupervisionAction(id){const d=await this.db.collection(this.c.supervisionActions).doc(String(id)).get();return d.exists?{id:d.id,...d.data()}:null}
async listOpenSupervisionActions(limit=100){const s=await this.db.collection(this.c.supervisionActions).limit(Math.max(limit*4,200)).get();return s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>['PENDING','WAITING_FOR_ACTION'].includes(x.status)).slice(0,limit)}
async findOpenSupervisionAction({seller,conversationId,actionType}){const key=String(seller||'').trim().toLowerCase();const s=await this.db.collection(this.c.supervisionActions).limit(500).get();return s.docs.map(d=>({id:d.id,...d.data()})).find(x=>String(x.sellerKey||x.seller||'').toLowerCase()===key&&String(x.conversationId)===String(conversationId)&&String(x.actionType)===String(actionType)&&['PENDING','WAITING_FOR_ACTION'].includes(x.status))||null}
async countActionRecurrence({seller,actionType}){const key=String(seller||'').trim().toLowerCase();const s=await this.db.collection(this.c.supervisionActions).limit(1000).get();return s.docs.map(d=>d.data()).filter(x=>String(x.sellerKey||x.seller||'').toLowerCase()===key&&String(x.actionType)===String(actionType)).length}
async listSupervisionActionsForSeller(seller,limit=500){const key=String(seller||'').trim().toLowerCase();const s=await this.db.collection(this.c.supervisionActions).limit(Math.max(limit,500)).get();return s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>String(x.sellerKey||x.seller||'').toLowerCase()===key).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,limit)}
async listSupervisionActionsForSellers(sellerKeys=[],limit=500){const wanted=new Set((sellerKeys||[]).map(x=>String(x||'').toLowerCase()).filter(Boolean));const s=await this.db.collection(this.c.supervisionActions).limit(Math.max(limit,500)).get();return s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>!wanted.size||wanted.has(String(x.sellerKey||x.seller||'').toLowerCase())).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,limit)}
async saveRemoteReport(id,data){await this.db.collection(this.c.remoteReports).doc(String(id)).set({...data,id:String(id),updatedAt:new Date().toISOString()},{merge:true})}
async getLatestRemoteReport(supervisorId){const s=await this.db.collection(this.c.remoteReports).limit(500).get();const rows=s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>String(x.supervisorId)===String(supervisorId)).sort((a,b)=>String(b.generatedAt||'').localeCompare(String(a.generatedAt||'')));return rows[0]||null}
async saveRemoteCheckpoint(id,data){await this.db.collection(this.c.remoteCheckpoints).doc(String(id)).set({...data,updatedAt:new Date().toISOString()},{merge:true})}
async getRemoteCheckpoint(id){const d=await this.db.collection(this.c.remoteCheckpoints).doc(String(id)).get();return d.exists?d.data():null}


async listConversationStatesSince(since,limit=2000){
  const iso=since instanceof Date?since.toISOString():String(since||'');
  if(!iso)return[];
  try{
    const s=await this.db.collection(this.c.conversations).where('metrics.lastMessageAt','>=',iso).orderBy('metrics.lastMessageAt','asc').limit(limit).get();
    return s.docs.map(d=>({id:d.id,...d.data()}));
  }catch(_){
    const s=await this.db.collection(this.c.conversations).limit(Math.max(limit,5000)).get();
    return s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>String(x.metrics?.lastMessageAt||x.updatedAt||'')>=iso).slice(0,limit);
  }
}
async getLiveDailyCase(date,conversationId){
  const id=`${date}__${Buffer.from(String(conversationId)).toString('base64url').slice(0,160)}`;
  const d=await this.db.collection(this.c.liveDailyCases).doc(id).get();
  return d.exists?{id:d.id,...d.data()}:null;
}
async saveLiveDailyCase(date,conversationId,data){
  const id=`${date}__${Buffer.from(String(conversationId)).toString('base64url').slice(0,160)}`;
  await this.db.collection(this.c.liveDailyCases).doc(id).set({date,conversationId,...data,updatedAt:new Date().toISOString()},{merge:true});
  return id;
}
async listLiveDailyCases(date,sellerKeys=[],limit=2000){
  const wanted=new Set((sellerKeys||[]).map(x=>String(x||'').trim().toLowerCase()).filter(Boolean));
  const s=await this.db.collection(this.c.liveDailyCases).where('date','==',String(date)).limit(limit).get();
  return s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>!wanted.size||wanted.has(String(x.sellerKey||x.row?.seller||x.row?.owner||'').toLowerCase()));
}
async saveLiveDailyObservation(id,data){
  await this.db.collection(this.c.liveDailyObservations).doc(String(id)).set({...data,id:String(id),updatedAt:new Date().toISOString()},{merge:true});
}
async listLiveDailyObservationsForSellers(sellerKeys=[],limit=2000){
  const wanted=new Set((sellerKeys||[]).map(x=>String(x||'').trim().toLowerCase()).filter(Boolean));
  const s=await this.db.collection(this.c.liveDailyObservations).limit(limit).get();
  return s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>!wanted.size||wanted.has(String(x.sellerKey||'').toLowerCase())).sort((a,b)=>String(b.openedAt||'').localeCompare(String(a.openedAt||'')));
}

async getLiveDailyBaseline(supervisorId){
  const d=await this.db.collection(this.c.liveDailyBaselines).doc(String(supervisorId)).get();
  return d.exists?{id:d.id,...d.data()}:null;
}
async saveLiveDailyBaseline(supervisorId,data){
  await this.db.collection(this.c.liveDailyBaselines).doc(String(supervisorId)).set({...data,supervisorId:String(supervisorId),updatedAt:new Date().toISOString()},{merge:true});
}

async saveLiveDailyReport(id,data){
  await this.db.collection(this.c.liveDailyReports).doc(String(id)).set({...data,id:String(id),updatedAt:new Date().toISOString()},{merge:true});
}
async getLatestLiveDailyReport(supervisorId){
  const s=await this.db.collection(this.c.liveDailyReports).limit(1000).get();
  const rows=s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>String(x.supervisorId)===String(supervisorId)).sort((a,b)=>String(b.generatedAt||'').localeCompare(String(a.generatedAt||'')));
  return rows[0]||null;
}
async listLatestLiveDailyReports(limit=1000){
  const s=await this.db.collection(this.c.liveDailyReports).limit(limit).get();
  return s.docs.map(d=>({id:d.id,...d.data()}));
}

async saveSupervisionSettings(data){await this.db.collection('supervisor_v3_supervision_settings').doc('global').set({...data,updatedAt:new Date().toISOString()},{merge:true})}
async getSupervisionSettings(){const d=await this.db.collection('supervisor_v3_supervision_settings').doc('global').get();return d.exists?{id:d.id,...d.data()}:null}


async acquireRemoteLock(id,{owner,now=new Date(),ttlMs=15*60*1000}={}){
  const ref=this.db.collection(this.c.remoteCheckpoints).doc(String(id));
  const nowMs=now instanceof Date?now.getTime():new Date(now).getTime();
  return await this.db.runTransaction(async tx=>{
    const d=await tx.get(ref),cur=d.exists?d.data():null,expires=cur?.expiresAt?new Date(cur.expiresAt).getTime():0;
    if(cur?.locked===true&&expires>nowMs)return{acquired:false,current:cur};
    const row={locked:true,owner:String(owner||''),acquiredAt:new Date(nowMs).toISOString(),expiresAt:new Date(nowMs+ttlMs).toISOString(),updatedAt:new Date().toISOString()};
    tx.set(ref,row,{merge:true});
    return{acquired:true,current:row};
  });
}
async releaseRemoteLock(id,{owner,now=new Date()}={}){
  const ref=this.db.collection(this.c.remoteCheckpoints).doc(String(id));
  await this.db.runTransaction(async tx=>{
    const d=await tx.get(ref);if(!d.exists)return;
    const cur=d.data();if(owner&&cur?.owner&&String(cur.owner)!==String(owner))return;
    tx.set(ref,{locked:false,releasedAt:(now instanceof Date?now:new Date(now)).toISOString(),updatedAt:new Date().toISOString()},{merge:true});
  });
}

}
module.exports={SupervisorStore};
