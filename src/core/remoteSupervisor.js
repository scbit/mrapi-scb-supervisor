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
  constructor({config,store,inbox,crm,aiProvider,telegram}){this.config=config;this.store=store;this.inbox=inbox;this.crm=crm;this.ai=aiProvider;this.telegram=telegram}
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
    return{timezone:'America/Argentina/Buenos_Aires',coaching:{enabled:true,responseWaitingMinutes:15,maxAiReviewsPerSellerTick:3},
      weekday:{days:['Mon','Tue','Wed','Thu','Fri'],startTime:'09:00',endTime:'17:00',pauseStart:'12:00',pauseEnd:'13:00',sellerFrequencyMinutes:30,generalFrequencyMinutes:60,generalChatId:null,generalDays:['Mon','Tue','Wed','Thu','Fri'],generalStartTime:'09:00',generalEndTime:'17:00'},
      weekend:{days:['Sat','Sun'],startTime:'09:00',endTime:'24:00',frequencyMinutes:120,chatId:null,minimumSignal:'MUY_INTERESANTE',sendStats:true,alertImportant:true}
    };
  }
  async getNetworkSetup(){
    const defaults=this.defaultNetworkSettings(),saved=await this.store.getSupervisionSettings()||{},settings={...defaults,...saved,coaching:{...defaults.coaching,...(saved.coaching||{})},weekday:{...defaults.weekday,...(saved.weekday||{})},weekend:{...defaults.weekend,...(saved.weekend||{})}};
    const supervisors=(await this.listSupervisors()).filter(x=>x.mode==='SELLER_GROUP');
    return{settings,sellers:await this.listSellerOptions(),sellerGroups:supervisors};
  }
  async saveNetworkSetup(input={}){
    const base=this.defaultNetworkSettings(),old=await this.store.getSupervisionSettings()||{},raw=input.settings||{};
    const settings={...base,...old,...raw,coaching:{...base.coaching,...(old.coaching||{}),...(raw.coaching||{})},weekday:{...base.weekday,...(old.weekday||{}),...(raw.weekday||{})},weekend:{...base.weekend,...(old.weekend||{}),...(raw.weekend||{})}};
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
    const setup=await this.getNetworkSetup(),active=setup.sellerGroups.filter(x=>x.enabled!==false),wanted=new Set(active.flatMap(x=>x.sellers||[]).map(normSeller));
    const convs=await this.store.listConversationStates(5000),mine=convs.filter(c=>wanted.has(normSeller(c.metrics?.owner||c.snapshot?.owner)));
    const waiting=mine.filter(c=>c.currentWaiting===true||c.metrics?.currentWaiting===true);
    const actions=await this.store.listSupervisionActionsForSellers([...wanted],500),pending=actions.filter(a=>['PENDING','WAITING_FOR_ACTION'].includes(a.status)),failed=actions.filter(a=>a.status==='FAILED'),verified=actions.filter(a=>a.status==='VERIFIED');
    const lines=['📊 SUPERVISIÓN GENERAL',`Vendedores supervisados: ${active.length}`,`Clientes esperando: ${waiting.length}`,`Correcciones pendientes: ${pending.length}`,`Correcciones no aplicadas: ${failed.length}`,`Correcciones aplicadas: ${verified.length}`];
    const bySeller=new Map();for(const c of waiting){const seller=c.metrics?.owner||c.snapshot?.owner||'Sin asignar';bySeller.set(seller,(bySeller.get(seller)||0)+1)}
    if(bySeller.size){lines.push('','⚠️ MAYOR ATENCIÓN');[...bySeller.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).forEach(([s,n])=>lines.push(`• ${s} — ${n} esperando`))}
    return{id:id('general_summary'),mode:'general',generatedAt:now.toISOString(),summary:{sellers:active.length,waiting:waiting.length,pending:pending.length,failed:failed.length,verified:verified.length},text:lines.join('\n')};
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
  async runSupervisor(supervisorId,{now=new Date(),send=true,force=false}={}){
    const cfg=await this.store.getRemoteSupervisor(supervisorId);if(!cfg)throw new Error('REMOTE_SUPERVISOR_NOT_FOUND');if(!cfg.enabled&&!force)return{skipped:true,reason:'disabled'};
    const sched=scheduleMode(cfg,now);if(!sched.active&&!force)return{skipped:true,reason:sched.reason};
    if(sched.mode==='weekend_guard'&&!force){
      const last=await this.store.getRemoteCheckpoint(`weekend_last_${cfg.id}`),freq=cfg.weekend.frequencyMinutes;if(last?.at&&now.getTime()-new Date(last.at).getTime()<freq*60000)return{skipped:true,reason:'weekend_frequency_not_due'};
      const report=await this.buildWeekendGuardReport(cfg,{now});await this.store.saveRemoteCheckpoint(`weekend_last_${cfg.id}`,{at:now.toISOString(),alerts:report?.summary?.alerts||0});
      if(!report)return{skipped:true,reason:'weekend_no_relevant_alerts'};
      await this.store.saveRemoteReport(report.id,report);let sent=null;if(send)sent=await this.telegram.send(report.text);return{skipped:false,mode:'weekend_guard',report,sent};
    }
    const last=await this.store.getRemoteCheckpoint(`last_send_${cfg.id}`);if(!force&&last?.at&&now.getTime()-new Date(last.at).getTime()<cfg.frequencyMinutes*60000)return{skipped:true,reason:'frequency_not_due'};
    const detected=await this.detectAutomaticActionsForSupervisor(cfg,{now}),verified=await this.verifyPending(),report=await this.buildSupervisorReport(cfg.id,{now});report.summary.autoDetected=detected.created.length;report.summary.aiReviewed=detected.reviewed;let sent=null;if(send){sent=await this.telegram.send(report.text,cfg.telegramChatId||undefined);await this.store.saveRemoteCheckpoint(`last_send_${cfg.id}`,{at:now.toISOString(),reportId:report.id})}return{skipped:false,mode:'weekday',detected,verified,report,sent};
  }
  async testSellerGroup(sellerId,{send=false}={}){
    const id='seller_group__'+Buffer.from(String(sellerId)).toString('base64url').slice(0,160),cfg=await this.store.getRemoteSupervisor(id);if(!cfg)throw new Error('SELLER_GROUP_NOT_CONFIGURED');
    const now=new Date(),detected=await this.detectAutomaticActionsForSupervisor(cfg,{now}),verified=await this.verifyPending(),report=await this.buildSupervisorReport(id,{now});report.summary.autoDetected=detected.created.length;report.summary.aiReviewed=detected.reviewed;let sent=null;if(send){if(!cfg.telegramChatId)throw new Error('SELLER_GROUP_TELEGRAM_CHAT_REQUIRED');sent=await this.telegram.send(report.text,cfg.telegramChatId)}return{detected,verified,report,sent};
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
    await this.verifyPending();
    for(const cfg of setup.sellerGroups.filter(x=>x.enabled!==false)){try{results.push({sellerId:cfg.sellerId,...await this.runSupervisor(cfg.id,{now,send})})}catch(e){results.push({sellerId:cfg.sellerId,error:e.message})}}
    const generalDays=wd.generalDays||wd.days||['Mon','Tue','Wed','Thu','Fri'],generalStart=mins(wd.generalStartTime||wd.startTime||'09:00'),generalEnd=mins(wd.generalEndTime||wd.endTime||'17:00');
    const generalActive=generalDays.includes(p.weekday)&&cur>=generalStart&&cur<generalEnd;
    if(generalActive){
      const gcp=await this.store.getRemoteCheckpoint('network_general_last'),gf=Number(wd.generalFrequencyMinutes||60);
      if(!gcp?.at||now-new Date(gcp.at)>=gf*60000){const report=await this.buildGeneralSummary({now}),sent=send&&wd.generalChatId?await this.telegram.send(report.text,wd.generalChatId):null;await this.store.saveRemoteCheckpoint('network_general_last',{at:now.toISOString(),reportId:report.id});results.push({general:true,report,sent})}
    }else results.push({general:true,skipped:true,reason:'general_outside_schedule'});
    return{at:now.toISOString(),mode:'weekday',results};
  }
  async sellerCompliance(seller){const rows=await this.store.listSupervisionActionsForSeller(seller,500),verified=rows.filter(x=>x.status==='VERIFIED').length,failed=rows.filter(x=>x.status==='FAILED').length,total=verified+failed,byType={};for(const r of rows)byType[r.actionType]=(byType[r.actionType]||0)+1;return{seller,total,verified,failed,pending:rows.filter(x=>['PENDING','WAITING_FOR_ACTION'].includes(x.status)).length,compliancePct:total?Math.round(verified/total*100):null,byType}}
}
module.exports={RemoteSupervisorService,ACTION_TYPES,QUALITATIVE_TYPES,DEFAULT_RUBRICS,normalizeSupervisorConfig,withinSchedule,scheduleMode,signalRank};
