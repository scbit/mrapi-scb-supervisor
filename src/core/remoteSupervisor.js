const {LiveDailySupervisor}=require('./liveDailySupervisor');
const crypto=require('crypto');

const ACTION_TYPES=['RESPOND','FOLLOW_UP','DISCOVERY','ADVISE','EXPLAIN_OPTIONS','DO_NOT_DISMISS','IMPROVE_RESPONSE','TRY_TO_CLOSE'];
const QUALITATIVE_TYPES=new Set(['DISCOVERY','ADVISE','EXPLAIN_OPTIONS','DO_NOT_DISMISS','IMPROVE_RESPONSE','TRY_TO_CLOSE']);
const DEFAULT_RUBRICS={
  DISCOVERY:['pregunta producto o mercadería','pregunta cantidad o volumen','pregunta origen','pregunta si tiene proveedor','busca entender objetivo comercial, reventa o recurrencia'],
  ADVISE:['explica al menos una alternativa concreta','adapta la recomendación al caso del cliente','evita una respuesta meramente operativa'],
  EXPLAIN_OPTIONS:['presenta opciones relevantes','explica diferencia o criterio para elegir','propone siguiente paso concreto'],
  DO_NOT_DISMISS:['mantiene la conversación abierta','hace al menos una pregunta útil','no cierra con una frase de despacho'],
  IMPROVE_RESPONSE:['responde con claridad','atiende la necesidad del cliente','agrega orientación o siguiente paso'],
  TRY_TO_CLOSE:['propone una acción concreta de avance','pide confirmación o dato necesario para avanzar','evita cierre pasivo']
};
const DEFAULT_WEEKDAYS=['Mon','Tue','Wed','Thu','Fri'];
const DEFAULT_WEEKEND_DAYS=['Sat','Sun'];

function id(prefix='rs'){return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`}
function asList(v){if(Array.isArray(v))return v.map(x=>String(x).trim()).filter(Boolean);return String(v||'').split(',').map(x=>x.trim()).filter(Boolean)}
function normSeller(v){return String(v||'').trim().toLowerCase()}
function safeInt(v,d,min,max){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):d}
function hhmm(v,d){const x=String(v||d);return /^([01]\d|2[0-3]):[0-5]\d$/.test(x)?x:d}
function localParts(date,timezone){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(date);const o={};for(const p of parts)o[p.type]=p.value;return{weekday:o.weekday,hour:Number(o.hour),minute:Number(o.minute)}}
function mins(x){const [h,m]=String(x).split(':').map(Number);return h*60+m}
function normalizeDays(v,fallback){const valid=new Set(['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);const rows=asList(v).filter(x=>valid.has(x));return rows.length?rows:[...fallback]}
function normalizeSupervisorConfig(input={},existing={}){
  const pauses=(Array.isArray(input.pauses)?input.pauses:existing.pauses||[{start:'12:00',end:'13:00'}]).map(p=>({start:hhmm(p.start,'12:00'),end:hhmm(p.end,'13:00')})).filter(p=>mins(p.end)>mins(p.start));
  const weekendIn=input.weekend||{},weekendOld=existing.weekend||{};
  return{
    id:String(input.id||existing.id||id('supervisor')),
    name:String(input.name??existing.name??'Supervisor remoto').trim()||'Supervisor remoto',
    enabled:input.enabled===undefined?(existing.enabled!==false):!!input.enabled,
    channel:'telegram',
    telegramChatId:String(input.telegramChatId??existing.telegramChatId??'').trim()||null,
    sellers:asList(input.sellers===undefined?existing.sellers:input.sellers),
    timezone:String(input.timezone||existing.timezone||'America/Argentina/Buenos_Aires'),
    weekdays:normalizeDays(input.weekdays===undefined?existing.weekdays:input.weekdays,DEFAULT_WEEKDAYS),
    startTime:hhmm(input.startTime||existing.startTime,'09:00'),
    endTime:hhmm(input.endTime||existing.endTime,'17:00'),
    pauses,
    frequencyMinutes:safeInt(input.frequencyMinutes??existing.frequencyMinutes,30,5,240),
    lookbackMinutes:safeInt(input.lookbackMinutes??existing.lookbackMinutes,45,10,240),
    weekend:{
      enabled:weekendIn.enabled===undefined?(weekendOld.enabled!==false):!!weekendIn.enabled,
      days:normalizeDays(weekendIn.days===undefined?weekendOld.days:weekendIn.days,DEFAULT_WEEKEND_DAYS),
      frequencyMinutes:safeInt(weekendIn.frequencyMinutes??weekendOld.frequencyMinutes,120,30,720),
      minimumSignal:String(weekendIn.minimumSignal||weekendOld.minimumSignal||'MUY_INTERESANTE').toUpperCase(),
      destination:'GENERAL_PERSONAL_TELEGRAM',
      alertOnly:true
    },
    content:{activity:true,waiting:true,responseQuality:true,pendingCorrections:true,verificationResults:true,...existing.content,...(input.content||{})},
    updatedAt:new Date().toISOString()
  };
}
function scheduleMode(cfg,now=new Date()){
  const p=localParts(now,cfg.timezone),cur=p.hour*60+p.minute;
  if(cfg.weekend?.enabled && (cfg.weekend.days||DEFAULT_WEEKEND_DAYS).includes(p.weekday))return{active:true,mode:'weekend_guard',reason:'weekend_guard'};
  if(!(cfg.weekdays||DEFAULT_WEEKDAYS).includes(p.weekday))return{active:false,mode:'off',reason:'day_disabled'};
  const start=mins(cfg.startTime),end=mins(cfg.endTime);if(cur<start||cur>=end)return{active:false,mode:'weekday',reason:'outside_hours'};
  for(const pause of cfg.pauses||[]){if(cur>=mins(pause.start)&&cur<mins(pause.end))return{active:false,mode:'weekday',reason:'pause'}}
  return{active:true,mode:'weekday',reason:'active'};
}
function withinSchedule(cfg,now=new Date()){const x=scheduleMode(cfg,now);return{active:x.active,reason:x.reason,mode:x.mode}}
function actionRubric(type,custom){const rows=asList(custom);return rows.length?rows:(DEFAULT_RUBRICS[type]||[])}
function signalRank(v){return {NORMAL:0,INTERESANTE:1,MUY_INTERESANTE:2,URGENTE:3,CRITICA:4}[String(v||'').toUpperCase()]??0}

class RemoteSupervisorService{
  constructor({config,store,inbox,crm,aiProvider,telegram}){this.config=config;this.store=store;this.inbox=inbox;this.crm=crm;this.ai=aiProvider;this.telegram=telegram;this.liveDaily=new LiveDailySupervisor({store,inbox,crm,aiProvider})}
  async listSupervisors(){return this.store.listRemoteSupervisors()}
  async saveSupervisor(data){const existing=data?.id?await this.store.getRemoteSupervisor(data.id):null;const cfg=normalizeSupervisorConfig(data,existing||{});if(mins(cfg.endTime)<=mins(cfg.startTime))throw new Error('REMOTE_SUPERVISOR_INVALID_HOURS');await this.store.saveRemoteSupervisor(cfg.id,cfg);return cfg}
  async listSellerOptions(){
    const map=new Map();
    if(this.crm?.listUsers){
      const users=await this.crm.listUsers(1000);
      for(const u of users){
        if(u.active===false||u.enabled===false||u.disabled===true)continue;
        const id=String(u.email||u.id||u.uid||u.name||'').trim();
        const label=String(u.displayName||u.fullName||u.name||u.label||u.email||u.id||'').trim();
        const email=String(u.email||'').trim();
        if(!id||!label)continue;
        if(/^(admin|oficina|basura|noreply|no-reply)@/i.test(email))continue;
        if(/\b(admin|administrador|system|sistema)\b/i.test(String(u.role||u.type||u.profile||'')))continue;
        map.set(id.toLowerCase(),{id,label,email:email||null,source:'CRM/HUB'});
      }
    }
    const deals=await this.store.listAllDeals(20000).catch(()=>[]);
    for(const d of deals){
      const owner=String(d.owner||d.ownerName||d.ownerEmail||d.snapshot?.owner||'').trim();if(!owner)continue;
      const k=owner.toLowerCase();if(!map.has(k))map.set(k,{id:owner,label:owner,email:owner.includes('@')?owner:null,source:'CRM/HUB owner'});
    }
    return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label,'es',{sensitivity:'base'}));
  }

  defaultNetworkSettings(){
    return{timezone:'America/Argentina/Buenos_Aires',coaching:{enabled:false,responseWaitingMinutes:15,maxAiReviewsPerSellerTick:0},liveDaily:{enabled:true,deliveryMode:'DRY_RUN',safety:{maxConversationsPerTick:250,maxDealsPerTick:2000,maxHunterEventsPerTick:5000,maxTelegramPerTick:25,maxTickSeconds:180,maxConsecutiveFailures:3,lockMinutes:15}},
      weekday:{days:['Mon','Tue','Wed','Thu','Fri'],startTime:'09:00',endTime:'17:00',pauseStart:'12:00',pauseEnd:'13:00',sellerFrequencyMinutes:30,generalFrequencyMinutes:60,generalChatId:null,generalDays:['Mon','Tue','Wed','Thu','Fri'],generalStartTime:'09:00',generalEndTime:'17:00'},
      weekend:{days:['Sat','Sun'],startTime:'09:00',endTime:'24:00',frequencyMinutes:120,chatId:null,minimumSignal:'MUY_INTERESANTE',sendStats:true,alertImportant:true}
    };
  }
  async getNetworkSetup(){
    const defaults=this.defaultNetworkSettings(),saved=await this.store.getSupervisionSettings()||{},settings={...defaults,...saved,coaching:{...defaults.coaching,...(saved.coaching||{})},liveDaily:{...defaults.liveDaily,...(saved.liveDaily||{}),safety:{...defaults.liveDaily.safety,...(saved.liveDaily?.safety||{})}},weekday:{...defaults.weekday,...(saved.weekday||{})},weekend:{...defaults.weekend,...(saved.weekend||{})}};
    const supervisors=(await this.listSupervisors()).filter(x=>x.mode==='SELLER_GROUP');
    return{settings,sellers:await this.listSellerOptions(),sellerGroups:supervisors};
  }
  async saveNetworkSetup(input={}){
    const base=this.defaultNetworkSettings(),old=await this.store.getSupervisionSettings()||{},raw=input.settings||{};
    const settings={...base,...old,...raw,coaching:{...base.coaching,...(old.coaching||{}),...(raw.coaching||{})},liveDaily:{...base.liveDaily,...(old.liveDaily||{}),...(raw.liveDaily||{}),safety:{...base.liveDaily.safety,...(old.liveDaily?.safety||{}),...(raw.liveDaily?.safety||{})}},weekday:{...base.weekday,...(old.weekday||{}),...(raw.weekday||{})},weekend:{...base.weekend,...(old.weekend||{}),...(raw.weekend||{})}};
    await this.store.saveSupervisionSettings(settings);
    const results=[];
    for(const row of input.sellerGroups||[]){
      const sellerId=String(row.sellerId||'').trim();if(!sellerId)continue;
      const id='seller_group__'+Buffer.from(sellerId).toString('base64url').slice(0,160);
      const existing=await this.store.getRemoteSupervisor(id)||{};
      const cfg=normalizeSupervisorConfig({
        ...existing,id,mode:'SELLER_GROUP',name:String(row.sellerLabel||sellerId),sellers:[sellerId],
        telegramChatId:String(row.telegramChatId||'').trim()||null,enabled:row.enabled!==false,
        weekdays:settings.weekday.days,startTime:settings.weekday.startTime,endTime:settings.weekday.endTime,
        pauses:[{start:settings.weekday.pauseStart,end:settings.weekday.pauseEnd}],frequencyMinutes:settings.weekday.sellerFrequencyMinutes
      },existing);
      cfg.mode='SELLER_GROUP';cfg.sellerId=sellerId;cfg.sellerLabel=String(row.sellerLabel||sellerId);await this.store.saveRemoteSupervisor(id,cfg);results.push(cfg);
    }
    return{settings,sellerGroups:results};
  }
  async buildGeneralSummary({now=new Date()}={}){
    const setup=await this.getNetworkSetup(),active=setup.sellerGroups.filter(x=>x.enabled!==false);
    const reports=await this.store.listLatestLiveDailyReports(1000),today=new Intl.DateTimeFormat('en-CA',{timeZone:setup.settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    const latestBy=new Map();
    for(const r of reports.filter(r=>r.date===today)){const prev=latestBy.get(r.supervisorId);if(!prev||String(r.generatedAt)>String(prev.generatedAt))latestBy.set(r.supervisorId,r)}
    const rows=active.map(cfg=>({cfg,report:latestBy.get(cfg.id)||null})),sum={sellers:active.length,clientChats:0,pending:0,corrected:0,notCorrected:0,redOverdue:0,noResponse:0,late:0};
    for(const x of rows){const q=x.report?.summary||{};sum.clientChats+=Number(q.clientChats||0);sum.pending+=Number(q.pending||0);sum.corrected+=Number(q.corrected||0);sum.notCorrected+=Number(q.notCorrected||0);sum.redOverdue+=Number(q.redOverdue||0);sum.noResponse+=Number(q.noResponse||0);sum.late+=Number(q.late||0)}
    const lines=['📊 GRUPO GENERAL DEL DÍA',`Fecha ${today}`,`Vendedores supervisados: ${sum.sellers}`,`Clientes del día: ${sum.clientChats}`,`Sin respuesta humana: ${sum.noResponse}`,`Respuestas tarde: ${sum.late}`,`🟠 Correcciones pendientes: ${sum.pending}`,`✅ Corregidas: ${sum.corrected}`,`❌ No corregidas: ${sum.notCorrected}`,`🔴 Tratos +7 días: ${sum.redOverdue}`];
    const attention=rows.filter(x=>x.report).sort((a,b)=>Number(b.report.summary?.redOverdue||0)-Number(a.report.summary?.redOverdue||0)||Number(b.report.summary?.pending||0)-Number(a.report.summary?.pending||0)).slice(0,8);
    if(attention.length){lines.push('','⚠️ ATENCIÓN POR VENDEDOR');for(const x of attention){const q=x.report.summary||{};lines.push(`• ${x.cfg.sellerLabel||x.cfg.name}: pendientes ${q.pending||0} · no corregidas ${q.notCorrected||0} · +7d ${q.redOverdue||0}`)}}
    return{id:id('general_summary'),mode:'general',date:today,generatedAt:now.toISOString(),summary:sum,text:lines.join('\n')};
  }
  async buildWeekendGlobalReport({now=new Date()}={}){
    const setup=await this.getNetworkSetup(),w=setup.settings.weekend,freq=Number(w.frequencyMinutes||120),from=new Date(now.getTime()-freq*60000);
    const dayStart=new Date(now);const parts=new Intl.DateTimeFormat('en-CA',{timeZone:setup.settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const obj={};for(const x of parts)obj[x.type]=x.value;
    const fromNine=new Date(`${obj.year}-${obj.month}-${obj.day}T09:00:00-03:00`);
    const convs=await this.inbox.listConversationsInRange({from:fromNine,to:now,limit:1000}),recent=convs.filter(c=>new Date(c.lastMessageAt||0)>=from);
    const newSinceNine=convs.filter(c=>c.createdAt&&new Date(c.createdAt)>=fromNine),newRecent=newSinceNine.filter(c=>new Date(c.createdAt)>=from);
    const adsRecent=newRecent.filter(c=>String(c.sourceChannel||'').toLowerCase().includes('meta')||!!c.adId||!!c.adTitle),unassignedRecent=newRecent.filter(c=>!c.owner&&!c.dealId);
    const alerts=[];
    if(w.alertImportant!==false){
      for(const c of recent){
        const messages=await this.inbox.getMessages(c.id,80),clientMsgs=messages.filter(m=>m.actor==='client'&&new Date(m.timestamp||0)>=from);if(!clientMsgs.length)continue;
        let evaluation={signal:'NORMAL',reason:'',summary:'',urgent:false};if(this.ai?.analyzeWeekendOpportunity)try{evaluation=await this.ai.analyzeWeekendOpportunity({conversation:c,messages:clientMsgs})}catch(_){}
        if(signalRank(evaluation.signal)>=signalRank(w.minimumSignal||'MUY_INTERESANTE')||evaluation.urgent===true)alerts.push({conversation:c,evaluation});
      }
    }
    const lines=['🌙 GUARDIA FIN DE SEMANA',`Revisión ${freq/60>=1?`cada ${freq/60} h`:`${freq} min`} · 09:00 a 24:00`,'',`Nuevos leads últimas ${freq/60}h: ${newRecent.length}`,`Meta Ads: ${adsRecent.length}`,`Sin vendedor asignado: ${unassignedRecent.length}`,`Nuevos leads desde las 09:00: ${newSinceNine.length}`];
    if(alerts.length){lines.push('','🚨 ALERTAS IMPORTANTES');for(const x of alerts.slice(0,10)){const c=x.conversation,e=x.evaluation;lines.push(`${String(e.signal||'ALERTA').replaceAll('_',' ')} — ${c.contactName||'Cliente sin nombre'}${!c.owner&&!c.dealId?' · SIN ASIGNAR':''}`,e.summary||e.reason||'Oportunidad relevante',`https://hub.sentirecustomsbroker.com/?conversationId=${encodeURIComponent(c.id)}`,'')}}
    else lines.push('','✅ Sin urgencias ni oportunidades excepcionales en esta revisión.');
    return{id:id('weekend_global'),mode:'weekend_guard',generatedAt:now.toISOString(),summary:{newRecent:newRecent.length,adsRecent:adsRecent.length,unassignedRecent:unassignedRecent.length,newSinceNine:newSinceNine.length,alerts:alerts.length},text:lines.join('\n')};
  }
  async createAction(input={}){
    const type=String(input.actionType||'').toUpperCase();if(!ACTION_TYPES.includes(type))throw new Error('REMOTE_ACTION_TYPE_INVALID');
    const seller=String(input.seller||input.sellerName||'').trim(),conversationId=String(input.conversationId||'').trim();if(!seller||!conversationId)throw new Error('REMOTE_ACTION_SELLER_AND_CONVERSATION_REQUIRED');
    const duplicate=await this.store.findOpenSupervisionAction({seller,conversationId,actionType:type});if(duplicate)return{...duplicate,duplicate:true};
    const createdAt=new Date().toISOString();const action={id:id('action'),supervisorId:String(input.supervisorId||'automatic'),seller,sellerKey:normSeller(seller),conversationId,actionType:type,reason:String(input.reason||'').trim(),expectedBehavior:String(input.expectedBehavior||'').trim(),rubric:actionRubric(type,input.rubric),verificationMode:QUALITATIVE_TYPES.has(type)?'AI':'DETERMINISTIC',status:'WAITING_FOR_ACTION',severity:String(input.severity||'MEDIUM').toUpperCase(),sourceDetection:String(input.sourceDetection||'MANUAL').trim(),sourceEvidence:input.sourceEvidence||null,createdAt,updatedAt:createdAt,attempts:0,recurrenceCount:await this.store.countActionRecurrence({seller,actionType:type})};await this.store.saveSupervisionAction(action.id,action);return action;
  }



  sellerScheduleStatus(cfg,now=new Date()){
    const setupDays=Array.isArray(cfg.days)&&cfg.days.length?cfg.days:['Mon','Tue','Wed','Thu','Fri'];
    const p=localParts(now,'America/Argentina/Buenos_Aires');
    const cur=p.hour*60+p.minute,start=mins(cfg.startTime||'09:00'),end=mins(cfg.endTime||'17:00');
    const inDay=setupDays.includes(p.weekday);
    const inHours=cur>=start&&cur<end;
    return{active:inDay&&inHours,inDay,inHours,weekday:p.weekday,currentMinutes:cur};
  }

  coachingCutoff(cfg,now=new Date()){
    const minutes=Math.max(Number(cfg.frequencyMinutes||30)*2,60);
    return new Date(now.getTime()-minutes*60000);
  }
  stateRelevantForCoaching(state,cfg,now=new Date()){
    const cutoff=this.coachingCutoff(cfg,now).getTime();
    const candidates=[
      state?.metrics?.waitingSince,
      state?.metrics?.lastCustomerMessageAt,
      state?.metrics?.lastMessageAt,
      state?.snapshot?.lastCustomerMessageAt,
      state?.snapshot?.lastMessageAt,
      state?.updatedAt
    ].filter(Boolean).map(x=>new Date(x).getTime()).filter(Number.isFinite);
    return candidates.length?Math.max(...candidates)>=cutoff:false;
  }

  async detectAutomaticActionsForSupervisor(cfg,{now=new Date()}={}){
    const setup=await this.getNetworkSetup(),coach=setup.settings.coaching||{};
    if(coach.enabled===false)return{created:[],reviewed:0,skipped:'disabled'};
    const sellerKeys=new Set((cfg.sellers||[]).map(normSeller));
    const states=(await this.store.listConversationStates(5000))
      .filter(c=>sellerKeys.has(normSeller(c.metrics?.owner||c.snapshot?.owner)))
      .sort((a,b)=>String(b.metrics?.lastMessageAt||b.updatedAt||'').localeCompare(String(a.metrics?.lastMessageAt||a.updatedAt||'')));
    const prior=await this.store.listSupervisionActionsForSellers([...sellerKeys],500);
    const openByConversation=new Set(prior.filter(a=>['PENDING','WAITING_FOR_ACTION'].includes(a.status)).map(a=>String(a.conversationId)));
    const created=[],waitingThreshold=Number(coach.responseWaitingMinutes||15),lookbackMinutes=Math.max(Number(cfg.frequencyMinutes||30)*2,60),cutoff=now.getTime()-lookbackMinutes*60000;

    for(const c of states){
      if(openByConversation.has(String(c.id)))continue;
      const waiting=c.currentWaiting===true||c.metrics?.waitingForHuman===true;
      const waitingMinutes=Number(c.metrics?.waitingMinutes||0);
      const relevant=this.stateRelevantForCoaching(c,cfg,now);
      if(waiting&&relevant&&waitingMinutes>=waitingThreshold){
        const seller=c.metrics?.owner||c.snapshot?.owner||cfg.sellerLabel||cfg.name;
        const a=await this.createAction({
          supervisorId:cfg.id,seller,conversationId:c.id,actionType:'RESPOND',
          severity:waitingMinutes>=30?'HIGH':'MEDIUM',sourceDetection:'WAITING_CLIENT',
          sourceEvidence:{waitingMinutes,waitingSince:c.metrics?.waitingSince||null,customerText:c.metrics?.waitingCustomerText||null},
          reason:`Cliente esperando respuesta hace ${waitingMinutes} min.`,
          expectedBehavior:'Responder al cliente con una respuesta humana útil y concreta, sin dejarlo esperando.'
        });
        if(!a.duplicate){created.push(a);openByConversation.add(String(c.id))}
      }
    }

    let reviewed=0;
    const maxAi=Math.max(0,Number(coach.maxAiReviewsPerSellerTick||3));
    if(!this.ai?.analyzeSupervisionNeed||maxAi===0)return{created,reviewed};
    for(const c of states){
      if(reviewed>=maxAi)break;
      if(openByConversation.has(String(c.id)))continue;
      const lastActivity=new Date(c.metrics?.lastSellerActivityAt||0).getTime();
      if(!Number.isFinite(lastActivity)||lastActivity<cutoff)continue;
      const checkpointId=`coach_review__${Buffer.from(String(c.id)).toString('base64url').slice(0,160)}`;
      const cp=await this.store.getRemoteCheckpoint(checkpointId);
      if(cp?.lastSellerActivityAt&&String(cp.lastSellerActivityAt)===String(c.metrics?.lastSellerActivityAt))continue;

      const conversation=await this.inbox.getConversation(c.id);if(!conversation)continue;
      const messages=await this.inbox.getMessages(c.id,120);
      const humans=messages.filter(m=>m.actor==='human');if(!humans.length)continue;
      const latestHuman=humans.at(-1);
      const hasClientBefore=messages.some(m=>m.actor==='client'&&new Date(m.timestamp||0)<=new Date(latestHuman.timestamp||0));
      if(!hasClientBefore){await this.store.saveRemoteCheckpoint(checkpointId,{lastSellerActivityAt:c.metrics?.lastSellerActivityAt,reviewedAt:now.toISOString(),result:'no_client_context'});continue}

      let evaluation=null,error=null;
      try{evaluation=await this.ai.analyzeSupervisionNeed({conversation,messages,seller:c.metrics?.owner||cfg.sellerLabel||cfg.name});reviewed++}
      catch(e){error=e.message}
      await this.store.saveRemoteCheckpoint(checkpointId,{lastSellerActivityAt:c.metrics?.lastSellerActivityAt,reviewedAt:now.toISOString(),result:evaluation||null,error});
      if(!evaluation?.requiresCorrection||!evaluation.actionType)continue;
      const seller=c.metrics?.owner||cfg.sellerLabel||cfg.name;
      const a=await this.createAction({
        supervisorId:cfg.id,seller,conversationId:c.id,actionType:evaluation.actionType,severity:evaluation.severity,
        sourceDetection:'AI_RESPONSE_QUALITY',
        sourceEvidence:{messageId:latestHuman.id||null,timestamp:latestHuman.timestamp||null,text:String(latestHuman.text||'').slice(0,1000),aiEvidence:evaluation.evidence||null},
        reason:evaluation.reason,expectedBehavior:evaluation.expectedBehavior,rubric:evaluation.rubric
      });
      if(!a.duplicate){created.push(a);openByConversation.add(String(c.id))}
    }
    return{created,reviewed};
  }

  async verifyAction(action){
    if(!['PENDING','WAITING_FOR_ACTION'].includes(action.status))return action;
    const messages=await this.inbox.getMessages(action.conversationId,200);const after=(messages||[]).filter(m=>m.actor==='human'&&new Date(m.timestamp||0)>new Date(action.createdAt));if(!after.length)return action;
    const next=after[0];let verification;
    if(action.verificationMode==='DETERMINISTIC')verification={verified:true,score:100,reason:`Se detectó una acción humana posterior a la corrección: ${String(next.text||'').slice(0,220)}`,evidenceMessageId:next.id,evidenceAt:next.timestamp};
    else verification=await this.ai.verifyCorrection({action,message:next,conversation:await this.inbox.getConversation(action.conversationId)});
    const status=verification.verified?'VERIFIED':'FAILED',updated={...action,status,attempts:Number(action.attempts||0)+1,nextRelevantSellerMessageAt:next.timestamp,verificationResult:verification,verifiedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await this.store.saveSupervisionAction(action.id,updated);return updated;
  }
  async verifyPending({limit=100}={}){const rows=await this.store.listOpenSupervisionActions(limit),out=[];for(const a of rows){try{out.push(await this.verifyAction(a))}catch(e){out.push({...a,verificationError:e.message})}}return out}
  async buildSupervisorReport(supervisorId,{now=new Date()}={}){
    const cfg=await this.store.getRemoteSupervisor(supervisorId);if(!cfg)throw new Error('REMOTE_SUPERVISOR_NOT_FOUND');const wanted=new Set((cfg.sellers||[]).map(normSeller)),convs=await this.store.listConversationStates(5000),mine=convs.filter(c=>!wanted.size||wanted.has(normSeller(c.metrics?.owner||c.snapshot?.owner)));
    const waiting=mine.filter(c=>(c.currentWaiting===true||c.metrics?.currentWaiting===true||c.metrics?.waitingForHuman===true)&&this.stateRelevantForCoaching(c,cfg,now)),sellers=new Map(),ensure=s=>{const k=normSeller(s||'Sin asignar');if(!sellers.has(k))sellers.set(k,{name:s||'Sin asignar',waiting:0,active:0,lastActivityAt:null});return sellers.get(k)};
    const configuredSellerLabel=cfg.sellerLabel||cfg.name||null;
    for(const c of mine){const seller=configuredSellerLabel||c.metrics?.owner||c.snapshot?.owner||'Sin asignar',s=ensure(seller);if(waiting.includes(c))s.waiting++;const iso=c.metrics?.lastSellerActivityAt;if(iso&&(!s.lastActivityAt||iso>s.lastActivityAt))s.lastActivityAt=iso}
    const cutoff=now.getTime()-cfg.lookbackMinutes*60000;for(const s of sellers.values())s.active=s.lastActivityAt&&new Date(s.lastActivityAt).getTime()>=cutoff?1:0;
    const actions=await this.store.listSupervisionActionsForSellers([...wanted],300),open=actions.filter(a=>['PENDING','WAITING_FOR_ACTION'].includes(a.status)),failedRecent=actions.filter(a=>a.status==='FAILED'&&a.verifiedAt&&new Date(a.verifiedAt).getTime()>=cutoff),recent=actions.filter(a=>a.status==='VERIFIED'&&a.verifiedAt&&new Date(a.verifiedAt).getTime()>=cutoff);
    const lines=[`SUPERVISOR REMOTO — ${cfg.name}`,`Horario ${cfg.startTime}-${cfg.endTime} · frecuencia ${cfg.frequencyMinutes} min`,'','👥 VENDEDORES'];
    for(const s of [...sellers.values()].sort((a,b)=>a.name.localeCompare(b.name)))lines.push(`${s.active?'🟢':'⚪'} ${s.name} — esperando ${s.waiting}`);
    lines.push('','🚨 CLIENTES ESPERANDO');if(!waiting.length)lines.push('Sin clientes esperando.');else waiting.slice(0,12).forEach(c=>lines.push(`• ${c.snapshot?.contactName||c.snapshot?.name||c.metrics?.contactName||c.id} — ${configuredSellerLabel||c.metrics?.owner||c.snapshot?.owner||'Sin asignar'}
https://hub.sentirecustomsbroker.com/?conversationId=${encodeURIComponent(c.id)}`));
    lines.push('','🎯 CORRECCIONES PENDIENTES');if(!open.length)lines.push('Sin correcciones pendientes.');else open.slice(0,12).forEach(a=>lines.push(`🟠 ${configuredSellerLabel||a.seller} — ${a.actionType}${a.severity?` · ${a.severity}`:''}\nProblema: ${a.reason||'-'}\nEsperado: ${a.expectedBehavior||'-'}\nhttps://hub.sentirecustomsbroker.com/?conversationId=${encodeURIComponent(a.conversationId)}`));
    if(failedRecent.length){lines.push('','❌ CORRECCIONES NO APLICADAS');failedRecent.slice(0,10).forEach(a=>lines.push(`• ${configuredSellerLabel||a.seller} — ${a.actionType}\n${a.verificationResult?.reason||'La siguiente acción no cumplió la corrección.'}\nhttps://hub.sentirecustomsbroker.com/?conversationId=${encodeURIComponent(a.conversationId)}`))}
    if(recent.length){lines.push('','✅ CORRECCIONES APLICADAS');recent.slice(0,10).forEach(a=>lines.push(`• ${configuredSellerLabel||a.seller} — ${a.actionType}${a.verificationResult?.reason?` — ${a.verificationResult.reason}`:''}`))}
    const report={id:id('remote_report'),supervisorId:cfg.id,mode:'weekday',generatedAt:now.toISOString(),configSnapshot:cfg,summary:{sellerCount:sellers.size,waiting:waiting.length,pendingCorrections:open.length,failedRecent:failedRecent.length,verifiedRecent:recent.length},text:lines.join('\n')};await this.store.saveRemoteReport(report.id,report);return report;
  }
  async buildWeekendGuardReport(cfg,{now=new Date()}={}){
    const freq=cfg.weekend?.frequencyMinutes||120,from=new Date(now.getTime()-freq*60000),convs=await this.inbox.listConversationsInRange({from,to:now,limit:300}),candidates=[];
    for(const c of convs){
      const isAd=String(c.sourceChannel||'').toLowerCase().includes('meta')||!!c.adId||!!c.adTitle;
      const unassigned=!c.owner&&!c.dealId;
      const messages=await this.inbox.getMessages(c.id,80),clientMsgs=messages.filter(m=>m.actor==='client'&&new Date(m.timestamp||0)>=from);
      if(!clientMsgs.length)continue;
      let evaluation={signal:'NORMAL',reason:'',summary:'',urgent:false};
      if(this.ai?.analyzeWeekendOpportunity)try{evaluation=await this.ai.analyzeWeekendOpportunity({conversation:c,messages:clientMsgs})}catch(_){}
      const min=cfg.weekend?.minimumSignal||'MUY_INTERESANTE';
      if(signalRank(evaluation.signal)>=signalRank(min)||evaluation.urgent===true)candidates.push({conversation:c,evaluation,isAd,unassigned});
    }
    if(!candidates.length)return null;
    const lines=['🚨 GUARDIA FIN DE SEMANA — SUPERVISOR SCB',`Revisión de las últimas ${freq} min · solo alertas importantes`,''];
    for(const x of candidates.slice(0,10)){const c=x.conversation,e=x.evaluation;lines.push(`${String(e.signal||'ALERTA').replaceAll('_',' ')} — ${c.contactName||'Cliente sin nombre'}${x.unassigned?' · SIN ASIGNAR':''}${x.isAd?' · META ADS':''}`,e.summary||e.reason||'Señal comercial relevante',`https://hub.sentirecustomsbroker.com/?conversationId=${encodeURIComponent(c.id)}`,'')}
    return{id:id('weekend_guard'),supervisorId:cfg.id,mode:'weekend_guard',generatedAt:now.toISOString(),summary:{alerts:candidates.length},text:lines.join('\n')};
  }
  async runSupervisor(supervisorId,{now=new Date(),send=true,force=false,activeDeals=null}={}){
    const cfg=await this.store.getRemoteSupervisor(supervisorId);if(!cfg)throw new Error('REMOTE_SUPERVISOR_NOT_FOUND');if(!cfg.enabled&&!force)return{skipped:true,reason:'disabled'};
    const sched=scheduleMode(cfg,now);if(!sched.active&&!force)return{skipped:true,reason:sched.reason};
    if(sched.mode==='weekend_guard'&&!force){
      const last=await this.store.getRemoteCheckpoint(`weekend_last_${cfg.id}`),freq=cfg.weekend.frequencyMinutes;if(last?.at&&now.getTime()-new Date(last.at).getTime()<freq*60000)return{skipped:true,reason:'weekend_frequency_not_due'};
      const report=await this.buildWeekendGuardReport(cfg,{now});await this.store.saveRemoteCheckpoint(`weekend_last_${cfg.id}`,{at:now.toISOString(),alerts:report?.summary?.alerts||0});
      if(!report)return{skipped:true,reason:'weekend_no_relevant_alerts'};
      await this.store.saveRemoteReport(report.id,report);let sent=null;if(send)sent=await this.telegram.send(report.text);return{skipped:false,mode:'weekend_guard',report,sent};
    }
    const last=await this.store.getRemoteCheckpoint(`last_send_${cfg.id}`);if(!force&&last?.at&&now.getTime()-new Date(last.at).getTime()<cfg.frequencyMinutes*60000)return{skipped:true,reason:'frequency_not_due'};
    const setup=await this.getNetworkSetup(),liveCfg=setup.settings.liveDaily||{enabled:true,deliveryMode:'DRY_RUN'};if(liveCfg.enabled===false)return{skipped:true,reason:'live_daily_disabled'};
    const analysis=await this.liveDaily.analyzeSellerGroup(cfg,{now,activeDeals,dateOverride}),built=this.liveDaily.buildTelegramReport(cfg,analysis,{now,deliveryMode:liveCfg.deliveryMode||'DRY_RUN'});
    const report={id:id('live_daily_report'),supervisorId:cfg.id,date:analysis.date,mode:'weekday_live_daily',generatedAt:now.toISOString(),summary:built.summary,text:built.text};await this.store.saveLiveDailyReport(report.id,report);
    const canSend=send&&(liveCfg.deliveryMode||'DRY_RUN')==='ACTIVE';let sent=null;if(canSend&&cfg.telegramChatId){sent=await this.telegram.send(report.text,cfg.telegramChatId);await this.store.saveRemoteCheckpoint(`last_send_${cfg.id}`,{at:now.toISOString(),reportId:report.id})}else if(!last?.at||force)await this.store.saveRemoteCheckpoint(`last_send_${cfg.id}`,{at:now.toISOString(),reportId:report.id,dryRun:true});
    return{skipped:false,mode:'weekday_live_daily',deliveryMode:liveCfg.deliveryMode||'DRY_RUN',analysis:{date:analysis.date,changedCases:analysis.changedCases.length,newObservations:analysis.observations.created.length+analysis.observations.overdue.created.length},report,sent};
  }
  async testSellerGroup(sellerId,{send=false,dateOverride=null}={}){
    const supervisorDocId='seller_group__'+Buffer.from(String(sellerId)).toString('base64url').slice(0,160),cfg=await this.store.getRemoteSupervisor(supervisorDocId);if(!cfg)throw new Error('SELLER_GROUP_NOT_CONFIGURED');
    const now=new Date(),setup=await this.getNetworkSetup(),liveCfg=setup.settings.liveDaily||{enabled:true,deliveryMode:'DRY_RUN'},activeDeals=await this.store.listActiveDeals(20000);
    const analysis=await this.liveDaily.analyzeSellerGroup(cfg,{now,activeDeals,dateOverride}),built=this.liveDaily.buildTelegramReport(cfg,analysis,{now,deliveryMode:liveCfg.deliveryMode||'DRY_RUN'});
    const report={id:id('live_daily_report'),supervisorId:cfg.id,date:analysis.date,mode:'weekday_live_daily',generatedAt:now.toISOString(),summary:built.summary,text:built.text};await this.store.saveLiveDailyReport(report.id,report);
    let sent=null;if(send&&(liveCfg.deliveryMode||'DRY_RUN')==='ACTIVE'){if(!cfg.telegramChatId)throw new Error('SELLER_GROUP_TELEGRAM_CHAT_REQUIRED');sent=await this.telegram.send(report.text,cfg.telegramChatId)}
    return{deliveryMode:liveCfg.deliveryMode||'DRY_RUN',analysis:{date:analysis.date,changedCases:analysis.changedCases.length,newObservations:analysis.observations.created.length+analysis.observations.overdue.created.length},report,sent};
  }
  async testGeneral({send=false,chatIdOverride=null}={}){const setup=await this.getNetworkSetup(),report=await this.buildGeneralSummary();let sent=null;if(send){const chatId=String(chatIdOverride||setup.settings.weekday.generalChatId||'').trim();if(!chatId)throw new Error('GENERAL_TELEGRAM_CHAT_REQUIRED');sent=await this.telegram.send(report.text,chatId)}return{report,sent}}
  async testWeekend({send=false,chatIdOverride=null}={}){const setup=await this.getNetworkSetup(),report=await this.buildWeekendGlobalReport();let sent=null;if(send){const chatId=String(chatIdOverride||setup.settings.weekend.chatId||'').trim();if(!chatId)throw new Error('WEEKEND_TELEGRAM_CHAT_REQUIRED');sent=await this.telegram.send(report.text,chatId)}return{report,sent}}
  async tick({now=new Date(),send=true}={}){
    const setup=await this.getNetworkSetup(),tz=setup.settings.timezone,p=localParts(now,tz),cur=p.hour*60+p.minute,results=[];
    const w=setup.settings.weekend;
    if((w.days||['Sat','Sun']).includes(p.weekday)){
      if(cur<9*60||cur>=24*60)return{at:now.toISOString(),mode:'weekend',results:[{skipped:true,reason:'outside_weekend_hours'}]};
      const cp=await this.store.getRemoteCheckpoint('network_weekend_last'),freq=Number(w.frequencyMinutes||120);
      if(cp?.at&&now-new Date(cp.at)<freq*60000)return{at:now.toISOString(),mode:'weekend',results:[{skipped:true,reason:'frequency_not_due'}]};
      const report=await this.buildWeekendGlobalReport({now}),sent=send&&w.chatId?await this.telegram.send(report.text,w.chatId):null;await this.store.saveRemoteCheckpoint('network_weekend_last',{at:now.toISOString(),reportId:report.id});return{at:now.toISOString(),mode:'weekend',results:[{report,sent}]};
    }
    const wd=setup.settings.weekday;if(!(wd.days||[]).includes(p.weekday)||cur<mins(wd.startTime)||cur>=mins(wd.endTime)|| (cur>=mins(wd.pauseStart)&&cur<mins(wd.pauseEnd)))return{at:now.toISOString(),mode:'weekday',results:[{skipped:true,reason:'outside_schedule_or_pause'}]};
    const activeDeals=await this.store.listActiveDeals(20000);
    for(const cfg of setup.sellerGroups.filter(x=>x.enabled!==false)){try{results.push({sellerId:cfg.sellerId,...await this.runSupervisor(cfg.id,{now,send,activeDeals})})}catch(e){results.push({sellerId:cfg.sellerId,error:e.message})}}
    const generalDays=wd.generalDays||wd.days||['Mon','Tue','Wed','Thu','Fri'],generalStart=mins(wd.generalStartTime||wd.startTime||'09:00'),generalEnd=mins(wd.generalEndTime||wd.endTime||'17:00');
    const generalActive=generalDays.includes(p.weekday)&&cur>=generalStart&&cur<generalEnd;
    if(generalActive){
      const gcp=await this.store.getRemoteCheckpoint('network_general_last'),gf=Number(wd.generalFrequencyMinutes||60);
      if(!gcp?.at||now-new Date(gcp.at)>=gf*60000){const report=await this.buildGeneralSummary({now}),sent=send&&wd.generalChatId?await this.telegram.send(report.text,wd.generalChatId):null;await this.store.saveRemoteCheckpoint('network_general_last',{at:now.toISOString(),reportId:report.id});results.push({general:true,report,sent})}
    }else results.push({general:true,skipped:true,reason:'general_outside_schedule'});
    return{at:now.toISOString(),mode:'weekday',results};
  }


  async saveCriticalSystemIncident(type,reason,details={}){
    const key=`${type}__${new Date().toISOString().slice(0,13)}`;
    await this.store.saveCriticalIncident(key,{
      type,category:'SYSTEM',severity:'CRITICAL',status:'OPEN',
      reason:String(reason||type),details,detectedAt:new Date().toISOString()
    });
  }

  async getAutomationHealth(){
    const setup=await this.getNetworkSetup(),control=await this.store.getRemoteCheckpoint('automation_control')||{},health=await this.store.getRemoteCheckpoint('automation_health')||{},lock=await this.store.getRemoteCheckpoint('automation_tick_lock')||{};
    const safety=setup.settings.liveDaily?.safety||{};
    const paused=control.paused===true||health.autoPaused===true;
    const scheduler=await this.store.getRemoteCheckpoint('scheduler_heartbeat')||{};
    const freq=Number(setup.settings.weekday?.sellerFrequencyMinutes||30);
    const schedulerAgeMs=scheduler.at?Date.now()-new Date(scheduler.at).getTime():null;
    const schedulerStatus=!scheduler.at?'NOT_CONNECTED':schedulerAgeMs<=(freq*2+15)*60000?'ACTIVE':'LATE';
    return{
      status:paused?'PAUSED':health.running===true?'RUNNING':health.lastError?'ERROR':'OK',
      scheduler:{status:schedulerStatus,lastHeartbeatAt:scheduler.at||null,lastMode:scheduler.mode||null,lastSuccessAt:scheduler.lastSuccessAt||null},
      paused,
      pauseReason:control.paused===true?(control.reason||'MANUAL'):health.autoPaused===true?(health.pauseReason||'AUTO_PAUSED'):null,
      deliveryMode:setup.settings.liveDaily?.deliveryMode||'DRY_RUN',
      sellerFrequencyMinutes:Number(setup.settings.weekday?.sellerFrequencyMinutes||30),
      limits:safety,
      lastTickAt:health.lastTickAt||null,
      lastSuccessAt:health.lastSuccessAt||null,
      lastDurationMs:health.lastDurationMs??null,
      lastError:health.lastError||null,
      consecutiveFailures:Number(health.consecutiveFailures||0),
      lastCore:health.lastCore||null,
      lastResultSummary:health.lastResultSummary||null,
      lock:lock.locked===true&&(!lock.expiresAt||new Date(lock.expiresAt)>new Date())?{locked:true,owner:lock.owner||null,acquiredAt:lock.acquiredAt||null,expiresAt:lock.expiresAt||null}:{locked:false}
    };
  }
  async pauseAutomation(reason='MANUAL_PAUSE'){
    await this.store.saveRemoteCheckpoint('automation_control',{paused:true,reason:String(reason||'MANUAL_PAUSE'),pausedAt:new Date().toISOString()});
    return this.getAutomationHealth();
  }
  async resumeAutomation(){
    await this.store.saveRemoteCheckpoint('automation_control',{paused:false,reason:null,resumedAt:new Date().toISOString()});
    await this.store.saveRemoteCheckpoint('automation_health',{autoPaused:false,pauseReason:null,consecutiveFailures:0,lastError:null});
    return this.getAutomationHealth();
  }
  async automationTick({engine,now=new Date(),send=true,force=false,source='manual'}={}){
    if(!engine)throw new Error('SUPERVISOR_ENGINE_REQUIRED');
    if(source==='scheduler')await this.store.saveRemoteCheckpoint('scheduler_heartbeat',{at:now.toISOString(),mode:'tick'});
    const setup=await this.getNetworkSetup(),safety=setup.settings.liveDaily?.safety||{},control=await this.store.getRemoteCheckpoint('automation_control')||{},prior=await this.store.getRemoteCheckpoint('automation_health')||{};
    if((control.paused===true||prior.autoPaused===true)&&!force)return{skipped:true,reason:'AUTOMATION_PAUSED',health:await this.getAutomationHealth()};

    const owner=`tick_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,ttlMs=Number(safety.lockMinutes||15)*60000;
    const lock=await this.store.acquireRemoteLock('automation_tick_lock',{owner,now,ttlMs});
    if(!lock.acquired)return{skipped:true,reason:'TICK_ALREADY_RUNNING',health:await this.getAutomationHealth()};

    const started=Date.now();
    await this.store.saveRemoteCheckpoint('automation_health',{running:true,lastTickAt:now.toISOString(),lastError:null});
    try{
      const core=await engine.run({now});
      const elapsedCore=Date.now()-started;
      const limits={
        conversations:Number(safety.maxConversationsPerTick||250),
        deals:Number(safety.maxDealsPerTick||2000),
        hunter:Number(safety.maxHunterEventsPerTick||5000),
        seconds:Number(safety.maxTickSeconds||180)
      };
      const hitConversationCap=Number(core.processedConversations||0)>=limits.conversations;
      const hitDealCap=core.crmMode==='incremental'&&Number(core.processedDeals||0)>=limits.deals;
      const hitHunterCap=Number(core.processedHunterEvents||0)>=limits.hunter;
      const timedOut=elapsedCore>limits.seconds*1000;
      if(hitConversationCap||hitDealCap||hitHunterCap||timedOut){
        const reasons=[hitConversationCap?'CONVERSATION_READ_CAP':null,hitDealCap?'DEAL_READ_CAP':null,hitHunterCap?'HUNTER_READ_CAP':null,timedOut?'TICK_TIMEOUT':null].filter(Boolean);
        await this.store.saveRemoteCheckpoint('automation_health',{
          running:false,autoPaused:true,pauseReason:reasons.join('+'),lastError:`Safety stop: ${reasons.join(', ')}`,
          lastDurationMs:Date.now()-started,lastCore:{processedConversations:core.processedConversations,processedDeals:core.processedDeals,processedHunterEvents:core.processedHunterEvents,crmMode:core.crmMode}
        });
        await this.saveCriticalSystemIncident('SAFETY_LIMIT_REACHED',reasons.join('+'),{processedConversations:core.processedConversations,processedDeals:core.processedDeals,processedHunterEvents:core.processedHunterEvents,crmMode:core.crmMode});
        return{skipped:true,reason:'SAFETY_LIMIT_REACHED',reasons,core:{processedConversations:core.processedConversations,processedDeals:core.processedDeals,processedHunterEvents:core.processedHunterEvents,crmMode:core.crmMode},health:await this.getAutomationHealth()};
      }

      const result=await this.tick({now,send});
      const resultRows=Array.isArray(result.results)?result.results:[];
      const actualTelegramSends=resultRows.filter(x=>x?.sent===true||x?.telegramSent===true||x?.delivery?.telegram===true).length;
      const maxTelegram=Number(safety.maxTelegramPerTick||25);
      const summary={mode:result.mode,results:resultRows.length,errors:resultRows.filter(x=>x?.error).length,telegramSent:actualTelegramSends};
      if(summary.errors>0)throw new Error(`REMOTE_TICK_PARTIAL_FAILURES:${summary.errors}`);
      if(send===true&&actualTelegramSends>maxTelegram&&!force){
        await this.store.saveRemoteCheckpoint('automation_health',{
          running:false,autoPaused:true,pauseReason:'TELEGRAM_BUDGET_EXCEEDED',
          lastError:`Actual Telegram sends ${actualTelegramSends} exceeded max ${maxTelegram}`,
          lastDurationMs:Date.now()-started,lastResultSummary:summary
        });
        await this.saveCriticalSystemIncident('TELEGRAM_BUDGET_EXCEEDED',`Actual Telegram sends ${actualTelegramSends} exceeded max ${maxTelegram}`,{actualTelegramSends,maxTelegram});
        return{skipped:true,reason:'TELEGRAM_BUDGET_EXCEEDED',result,health:await this.getAutomationHealth()};
      }
      await this.store.saveRemoteCheckpoint('automation_health',{
        running:false,autoPaused:false,pauseReason:null,lastSuccessAt:new Date().toISOString(),lastDurationMs:Date.now()-started,
        consecutiveFailures:0,lastError:null,
        lastCore:{processedConversations:core.processedConversations,processedDeals:core.processedDeals,processedHunterEvents:core.processedHunterEvents,crmMode:core.crmMode},
        lastResultSummary:summary
      });
      if(source==='scheduler')await this.store.saveRemoteCheckpoint('scheduler_heartbeat',{at:now.toISOString(),mode:result.mode||'tick',lastSuccessAt:new Date().toISOString()});
      return{skipped:false,core:{processedConversations:core.processedConversations,processedDeals:core.processedDeals,processedHunterEvents:core.processedHunterEvents,crmMode:core.crmMode},result,health:await this.getAutomationHealth()};
    }catch(e){
      const failures=Number(prior.consecutiveFailures||0)+1,maxFailures=Number(safety.maxConsecutiveFailures||3),autoPaused=failures>=maxFailures;
      await this.store.saveRemoteCheckpoint('automation_health',{
        running:false,consecutiveFailures:failures,autoPaused,pauseReason:autoPaused?'CIRCUIT_BREAKER':null,lastError:String(e.message||e),lastDurationMs:Date.now()-started,lastTickAt:now.toISOString()
      });
      if(autoPaused)await this.saveCriticalSystemIncident('CIRCUIT_BREAKER',`Automation paused after ${failures} consecutive failures`,{failures,error:String(e.message||e)});
      const err=new Error(autoPaused?`AUTOMATION_PAUSED_AFTER_${failures}_FAILURES:${e.message}`:e.message);err.cause=e;throw err;
    }finally{
      await this.store.releaseRemoteLock('automation_tick_lock',{owner,now:new Date()}).catch(()=>{});
    }
  }

  async sellerCompliance(seller){const rows=await this.store.listSupervisionActionsForSeller(seller,500),verified=rows.filter(x=>x.status==='VERIFIED').length,failed=rows.filter(x=>x.status==='FAILED').length,total=verified+failed,byType={};for(const r of rows)byType[r.actionType]=(byType[r.actionType]||0)+1;return{seller,total,verified,failed,pending:rows.filter(x=>['PENDING','WAITING_FOR_ACTION'].includes(x.status)).length,compliancePct:total?Math.round(verified/total*100):null,byType}}
}
module.exports={RemoteSupervisorService,ACTION_TYPES,QUALITATIVE_TYPES,DEFAULT_RUBRICS,normalizeSupervisorConfig,withinSchedule,scheduleMode,signalRank};
