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
    emailTo:String(input.emailTo??existing.emailTo??'').trim()||null,
    sendTelegram:input.sendTelegram===undefined?(existing.sendTelegram!==false):!!input.sendTelegram,
    sendEmail:input.sendEmail===undefined?!!existing.sendEmail:!!input.sendEmail,
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
  constructor({config,store,inbox,crm,aiProvider,telegram,email}){this.config=config;this.store=store;this.inbox=inbox;this.crm=crm;this.ai=aiProvider;this.telegram=telegram;this.email=email}
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
        if(!id||!label)continue;
        map.set(id.toLowerCase(),{id,label,email:String(u.email||'').trim()||null,role:String(u.role||u.type||u.profile||'').trim()||null,source:'crm_users'});
      }
    }
    const deals=await this.store.listAllDeals(20000).catch(()=>[]);
    for(const d of deals){
      const owner=String(d.owner||d.ownerName||d.ownerEmail||d.snapshot?.owner||'').trim();
      if(!owner)continue;
      const k=owner.toLowerCase();
      if(!map.has(k))map.set(k,{id:owner,label:owner,email:owner.includes('@')?owner:null,role:null,source:'crm_deals'});
    }
    return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label,'es',{sensitivity:'base'}));
  }
  async createAction(input={}){
    const type=String(input.actionType||'').toUpperCase();if(!ACTION_TYPES.includes(type))throw new Error('REMOTE_ACTION_TYPE_INVALID');
    const seller=String(input.seller||input.sellerName||'').trim(),conversationId=String(input.conversationId||'').trim();if(!seller||!conversationId)throw new Error('REMOTE_ACTION_SELLER_AND_CONVERSATION_REQUIRED');
    const duplicate=await this.store.findOpenSupervisionAction({seller,conversationId,actionType:type});if(duplicate)return{...duplicate,duplicate:true};
    const createdAt=new Date().toISOString();const action={id:id('action'),supervisorId:String(input.supervisorId||'automatic'),seller,sellerKey:normSeller(seller),conversationId,actionType:type,reason:String(input.reason||'').trim(),expectedBehavior:String(input.expectedBehavior||'').trim(),rubric:actionRubric(type,input.rubric),verificationMode:QUALITATIVE_TYPES.has(type)?'AI':'DETERMINISTIC',status:'WAITING_FOR_ACTION',createdAt,updatedAt:createdAt,attempts:0,recurrenceCount:await this.store.countActionRecurrence({seller,actionType:type})};await this.store.saveSupervisionAction(action.id,action);return action;
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
    const waiting=mine.filter(c=>c.currentWaiting===true||c.metrics?.currentWaiting===true),sellers=new Map(),ensure=s=>{const k=normSeller(s||'Sin asignar');if(!sellers.has(k))sellers.set(k,{name:s||'Sin asignar',waiting:0,active:0,lastActivityAt:null});return sellers.get(k)};
    for(const c of mine){const seller=c.metrics?.owner||c.snapshot?.owner||'Sin asignar',s=ensure(seller);if(c.currentWaiting===true||c.metrics?.currentWaiting===true)s.waiting++;const iso=c.metrics?.lastSellerActivityAt;if(iso&&(!s.lastActivityAt||iso>s.lastActivityAt))s.lastActivityAt=iso}
    const cutoff=now.getTime()-cfg.lookbackMinutes*60000;for(const s of sellers.values())s.active=s.lastActivityAt&&new Date(s.lastActivityAt).getTime()>=cutoff?1:0;
    const actions=await this.store.listSupervisionActionsForSellers([...wanted],200),open=actions.filter(a=>['PENDING','WAITING_FOR_ACTION','FAILED'].includes(a.status)),recent=actions.filter(a=>a.status==='VERIFIED'&&a.verifiedAt&&new Date(a.verifiedAt).getTime()>=cutoff);
    const lines=[`SUPERVISOR REMOTO — ${cfg.name}`,`Horario ${cfg.startTime}-${cfg.endTime} · frecuencia ${cfg.frequencyMinutes} min`,'','👥 VENDEDORES'];
    for(const s of [...sellers.values()].sort((a,b)=>a.name.localeCompare(b.name)))lines.push(`${s.active?'🟢':'⚪'} ${s.name} — esperando ${s.waiting}`);
    lines.push('','🚨 CLIENTES ESPERANDO');if(!waiting.length)lines.push('Sin clientes esperando.');else waiting.slice(0,12).forEach(c=>lines.push(`• ${c.snapshot?.contactName||c.id} — ${c.metrics?.owner||c.snapshot?.owner||'Sin asignar'} — https://hub.sentirecustomsbroker.com/?conversationId=${encodeURIComponent(c.id)}`));
    lines.push('','🎯 CORRECCIONES');if(!open.length)lines.push('Sin correcciones pendientes.');else open.slice(0,12).forEach(a=>lines.push(`${a.status==='FAILED'?'❌':'🟠'} ${a.seller} — ${a.actionType} — ${a.status}\nhttps://hub.sentirecustomsbroker.com/?conversationId=${encodeURIComponent(a.conversationId)}`));
    if(recent.length){lines.push('','✅ CORRECCIONES APLICADAS');recent.slice(0,10).forEach(a=>lines.push(`• ${a.seller} — ${a.actionType}`))}
    const report={id:id('remote_report'),supervisorId:cfg.id,mode:'weekday',generatedAt:now.toISOString(),configSnapshot:cfg,summary:{sellerCount:sellers.size,waiting:waiting.length,pendingCorrections:open.length,verifiedRecent:recent.length},text:lines.join('\n')};await this.store.saveRemoteReport(report.id,report);return report;
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
    const verified=await this.verifyPending(),report=await this.buildSupervisorReport(cfg.id,{now});let sent={telegram:null,email:null};if(send){
      if(cfg.sendTelegram!==false)sent.telegram=await this.telegram.send(report.text,cfg.telegramChatId||undefined);
      if(cfg.sendEmail&&cfg.emailTo&&this.email)sent.email=await this.email.send({to:cfg.emailTo,subject:`SUPERVISOR SCB — ${cfg.name}`,bodyText:report.text,operationId:`remote-${cfg.id}-${Date.now()}`,source:'supervisor-scb-remote'});
      await this.store.saveRemoteCheckpoint(`last_send_${cfg.id}`,{at:now.toISOString(),reportId:report.id});
    }return{skipped:false,mode:'weekday',verified,report,sent};
  }
  async tick({now=new Date(),send=true}={}){const configs=(await this.listSupervisors()).filter(x=>x.enabled),results=[];for(const cfg of configs){try{results.push({supervisorId:cfg.id,...await this.runSupervisor(cfg.id,{now,send})})}catch(e){results.push({supervisorId:cfg.id,error:e.message})}}return{at:now.toISOString(),results}}
  async sellerCompliance(seller){const rows=await this.store.listSupervisionActionsForSeller(seller,500),verified=rows.filter(x=>x.status==='VERIFIED').length,failed=rows.filter(x=>x.status==='FAILED').length,total=verified+failed,byType={};for(const r of rows)byType[r.actionType]=(byType[r.actionType]||0)+1;return{seller,total,verified,failed,pending:rows.filter(x=>['PENDING','WAITING_FOR_ACTION'].includes(x.status)).length,compliancePct:total?Math.round(verified/total*100):null,byType}}
}
module.exports={RemoteSupervisorService,ACTION_TYPES,QUALITATIVE_TYPES,DEFAULT_RUBRICS,normalizeSupervisorConfig,withinSchedule,scheduleMode,signalRank};
