
const crypto=require('crypto');
const {analyzeConversation,applyAi,needsAi,summary,exclusionReason,hubUrl}=require('./dailyGerencial');

const ACTIVE_OVERDUE_STAGES=new Set(['SEGUIMIENTO','MARCA PERSONAL','COTIZADO PARA ENVIAR','HORNO']);
const OPEN_STATUSES=new Set(['PENDING','NOT_CORRECTED']);
function norm(v){return String(v||'').trim().toLowerCase()}
function stage(v){return String(v||'').trim().toUpperCase().replace(/\s+/g,' ')}
function id(prefix='obs'){return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`}
function argentinaDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
function dayRange(date,now=new Date()){
  const from=new Date(`${date}T09:00:00.000-03:00`);
  const end=new Date(`${date}T17:00:00.000-03:00`);
  const today=argentinaDate(now)===date;
  const to=today&&now<end?now:new Date(end.getTime()-1);
  return{from,to,fullFrom:new Date(`${date}T00:00:00.000-03:00`),fullTo:new Date(`${date}T23:59:59.999-03:00`)};
}
function issueMap(row){
  const m=new Map();
  if(row.noHumanResponse||row.botOnly)m.set('NO_HUMAN_RESPONSE',{issueType:'NO_HUMAN_RESPONSE',severity:'HIGH',reason:row.botOnly?'El cliente quedó atendido solo por bot, sin respuesta humana.':'El cliente escribió y no tuvo respuesta humana.',expected:'Responder al cliente de forma humana y útil.'});
  const latestLate=(row.lateResponses||[]).at(-1);
  if(latestLate && (!row.lastHumanAt || latestLate.humanAt===row.lastHumanAt))m.set('LATE_RESPONSE',{issueType:'LATE_RESPONSE',severity:latestLate.minutes>=60?'HIGH':'MEDIUM',reason:`Respuesta tardía: ${latestLate.minutes} min.`,expected:'Responder dentro del tiempo objetivo en la próxima interacción.'});
  if(row.operationalWithoutDiscovery)m.set('OPERATIONAL_WITHOUT_DISCOVERY',{issueType:'OPERATIONAL_WITHOUT_DISCOVERY',severity:'HIGH',reason:'Respondió de forma operativa sin indagar necesidad comercial.',expected:'Indagar producto, volumen, origen/proveedor y objetivo antes de cerrar la respuesta.'});
  if(row.unexploredPotential)m.set('UNEXPLORED_POTENTIAL',{issueType:'UNEXPLORED_POTENTIAL',severity:'HIGH',reason:'Hay potencial comercial no explorado.',expected:'Profundizar oportunidad y proponer un siguiente paso concreto.'});
  if(row.needsReviewByAi&&!row.operationalWithoutDiscovery&&!row.unexploredPotential)m.set('POOR_COMMERCIAL_RESPONSE',{issueType:'POOR_COMMERCIAL_RESPONSE',severity:'MEDIUM',reason:'La respuesta comercial requiere mejora según la misma lógica del Daily Gerencial V3.',expected:'Mejorar claridad, asesoramiento y siguiente paso comercial.'});
  return m;
}
function observationKey(sellerKey,caseKey,issueType){return `${sellerKey}__${Buffer.from(String(caseKey)).toString('base64url').slice(0,120)}__${issueType}`}

function buildCommercialCase(row){
  const latestLate=(row.lateResponses||[]).at(-1);
  const responseMinutes=latestLate?.minutes??null;

  let responseTime={code:'OK',label:'A tiempo',level:'GOOD',minutes:responseMinutes};
  if(row.noHumanResponse||row.botOnly) responseTime={code:'NO_HUMAN_RESPONSE',label:'Sin respuesta humana',level:'BAD',minutes:null};
  else if(responseMinutes!==null&&responseMinutes>=60) responseTime={code:'VERY_LATE',label:`Muy tardía (${responseMinutes} min)`,level:'BAD',minutes:responseMinutes};
  else if(responseMinutes!==null&&responseMinutes>=30) responseTime={code:'LATE',label:`Tardía (${responseMinutes} min)`,level:'WARN',minutes:responseMinutes};

  let responseQuality={code:'GOOD',label:'Buena',level:'GOOD'};
  if(row.needsReviewByAi) responseQuality={code:'REGULAR',label:'Regular',level:'WARN'};
  if(row.operationalWithoutDiscovery&&row.unexploredPotential) responseQuality={code:'POOR',label:'Pobre',level:'BAD'};

  let advisory={code:'GOOD',label:'Asesoró bien',level:'GOOD'};
  if(row.operationalWithoutDiscovery) advisory={code:'PARTIAL',label:'Asesoramiento parcial',level:'WARN'};
  if(row.operationalWithoutDiscovery&&row.unexploredPotential) advisory={code:'POOR',label:'Asesoramiento pobre',level:'BAD'};

  let guidance={code:'GOOD',label:'Guió al cliente',level:'GOOD'};
  if(row.unexploredPotential) guidance={code:'INSUFFICIENT',label:'Guía insuficiente',level:'BAD'};
  else if(row.needsReviewByAi) guidance={code:'PARTIAL',label:'Guía parcial',level:'WARN'};

  let opportunity={code:'DEVELOPED',label:'Oportunidad desarrollada',level:'GOOD'};
  if(row.unexploredPotential) opportunity={code:'NOT_DEVELOPED',label:'Oportunidad no desarrollada',level:'BAD'};
  else if(row.operationalWithoutDiscovery) opportunity={code:'PARTIAL',label:'Desarrollo parcial',level:'WARN'};

  let followUp={code:'OK',label:'Seguimiento correcto',level:'GOOD'};
  if(row.noHumanResponse||row.botOnly) followUp={code:'MISSING',label:'Falta seguimiento/respuesta humana',level:'BAD'};

  const dimensions={responseTime,responseQuality,advisory,guidance,opportunity,followUp};
  const bad=Object.values(dimensions).filter(x=>x.level==='BAD').length;
  const warn=Object.values(dimensions).filter(x=>x.level==='WARN').length;
  const verdict=bad?'A_CORREGIR':warn?'REVISAR':'BIEN_TRABAJADO';

  const findings=[];
  for(const [key,val] of Object.entries(dimensions)){
    if(val.level!=='GOOD') findings.push({code:key.toUpperCase(),label:val.label,severity:val.level==='BAD'?'HIGH':'MEDIUM'});
  }

  let expected='Mantener la calidad actual y dejar siempre un siguiente paso concreto.';
  if(advisory.level!=='GOOD'||guidance.level!=='GOOD'||opportunity.level!=='GOOD'){
    expected='Aprovechar el contexto ya relevado por el bot/humano, asesorar activamente, orientar al cliente con opciones concretas, desarrollar oportunidades relacionadas y dejar un próximo paso claro. Evitar respuestas pasivas o limitarse a “avisame”.';
  } else if(responseTime.level!=='GOOD'){
    expected='Mejorar el tiempo de respuesta sin perder calidad comercial.';
  } else if(followUp.level!=='GOOD'){
    expected='Retomar el cliente y asegurar continuidad de seguimiento.';
  }

  return{
    verdict,
    quality:verdict,
    dimensions,
    findings,
    severity:bad?'HIGH':warn?'MEDIUM':'LOW',
    expected
  };
}

class LiveDailySupervisor{
  constructor({store,inbox,crm,aiProvider}){this.store=store;this.inbox=inbox;this.crm=crm;this.ai=aiProvider}

  async analyzeSellerGroup(cfg,{now=new Date(),activeDeals=null,dateOverride=null}={}){
    const date=dateOverride||argentinaDate(now),range=dayRange(date,now),sellerKeys=(cfg.sellers||[]).map(norm),wanted=new Set(sellerKeys);
    const states=await this.store.listConversationStatesSince(range.fullFrom.toISOString(),2000);
    const relevantStates=states.filter(x=>wanted.has(norm(x.metrics?.owner||x.snapshot?.owner)));
    const changedCases=[];

    for(const st of relevantStates){
      const fingerprint=String(st.fingerprint||st.sourceFingerprint||st.updatedAt||'');
      const cached=await this.store.getLiveDailyCase(date,st.id);
      if(cached?.sourceFingerprint===fingerprint)continue;

      const c=await this.inbox.getConversation(st.id);if(!c)continue;
      const messages=await this.inbox.getMessages(st.id,150);
      let row=analyzeConversation(c,messages,range,30);
      if(!row.messagesInWindow)continue;

      const human=[...messages].reverse().find(m=>m.actor==='human'&&m.user);
      if(human?.user)row.seller=row.owner=human.user;
      if(!wanted.has(norm(row.seller||row.owner)))continue;

      const ex=exclusionReason(c,row,messages);
      if(ex){
        await this.store.saveLiveDailyCase(date,st.id,{sellerKey:norm(row.seller||row.owner),sourceFingerprint:fingerprint,row:{...row,excludedFromReport:true,exclusionReason:ex}});
        continue;
      }

      if(needsAi(row)&&this.ai?.isConfigured?.()){
        try{
          const ai=await this.ai.analyzeConversation(c,messages);
          row=applyAi(row,ai);
        }catch(e){row.aiError=e.message}
      }

      row.hubUrl=hubUrl(row.conversationId);
      await this.store.saveLiveDailyCase(date,st.id,{sellerKey:norm(row.seller||row.owner),sourceFingerprint:fingerprint,row});
      changedCases.push(row);
    }

    const cases=(await this.store.listLiveDailyCases(date,sellerKeys,2000)).filter(x=>!x.row?.excludedFromReport&&Number(x.row?.inboundCount||0)>0).map(x=>x.row);
    const observations=await this.reconcileConversationObservations(cfg,cases,{now,date});
    const overdue=await this.reconcileOverdueDeals(cfg,{now,date,activeDeals});
    const allObs=await this.store.listLiveDailyObservationsForSellers(sellerKeys,2000);
    const groupObs=allObs.filter(o=>sellerKeys.includes(norm(o.sellerKey||o.seller)));
    const dailySummary=summary(cases);
    return{date,cases,changedCases,bySeller:dailySummary,observations:{...observations,overdue},allObservations:groupObs};
  }

  async reconcileConversationObservations(cfg,cases,{now,date}){
    const sellerKeys=(cfg.sellers||[]).map(norm),existing=await this.store.listLiveDailyObservationsForSellers(sellerKeys,2000),openByCase=new Map();

    // Migration: older builds created one observation per issue. New business rule is one chat = one case.
    for(const o of existing){
      if(o.source==='DAILY_V3'&&o.supervisorId===cfg.id&&o.issueType!=='COMMERCIAL_CHAT_CASE'&&OPEN_STATUSES.has(o.status)){
        await this.store.saveLiveDailyObservation(o.id,{
          status:'SUPERSEDED',
          supersededAt:now.toISOString(),
          supersededReason:'Migrated to one-chat-one-case supervision'
        });
        o.status='SUPERSEDED';
      }
    }

    for(const o of existing.filter(o=>o.source==='DAILY_V3'&&o.issueType==='COMMERCIAL_CHAT_CASE'&&OPEN_STATUSES.has(o.status)&&o.supervisorId===cfg.id)) openByCase.set(String(o.caseKey),o);
    const created=[],corrected=[],notCorrected=[];
    for(const row of cases){
      const caseKey=String(row.conversationId),commercial=buildCommercialCase(row); let obs=openByCase.get(caseKey);
      if(commercial.quality!=='BIEN_TRABAJADO'){
        if(!obs){
          obs={id:id('daily_case'),source:'DAILY_V3',supervisorId:cfg.id,seller:row.seller||row.owner,sellerKey:norm(row.seller||row.owner),caseKey,conversationId:row.conversationId,dealId:row.dealId||null,issueType:'COMMERCIAL_CHAT_CASE',severity:commercial.severity,status:'PENDING',quality:commercial.quality,dimensions:commercial.dimensions,findings:commercial.findings,reason:commercial.findings.map(x=>x.label).join(' | '),expected:commercial.expected,openedAt:now.toISOString(),lastSeenAt:now.toISOString(),lastHumanAtAtDetection:row.lastHumanAt||null,sourceDate:date,hubUrl:row.hubUrl};
          await this.store.saveLiveDailyObservation(obs.id,obs); created.push(obs); openByCase.set(caseKey,obs);
        }else{
          const newHuman=!!row.lastHumanAt&&!!obs.lastHumanAtAtDetection&&new Date(row.lastHumanAt)>new Date(obs.lastHumanAtAtDetection);
          const patch={lastSeenAt:now.toISOString(),severity:commercial.severity,quality:commercial.quality,dimensions:commercial.dimensions,findings:commercial.findings,reason:commercial.findings.map(x=>x.label).join(' | '),expected:commercial.expected};
          if(newHuman){patch.status='NOT_CORRECTED';patch.lastHumanAtAtDetection=row.lastHumanAt;patch.notCorrectedAt=now.toISOString();patch.attempts=Number(obs.attempts||0)+1;notCorrected.push({...obs,...patch})}
          await this.store.saveLiveDailyObservation(obs.id,patch);
        }
      }else if(obs){
        const hasNewHuman=!!row.lastHumanAt&&(!obs.lastHumanAtAtDetection||new Date(row.lastHumanAt)>new Date(obs.lastHumanAtAtDetection));
        if(hasNewHuman){const patch={status:'CORRECTED',quality:'BIEN_TRABAJADO',correctedAt:now.toISOString(),lastSeenAt:now.toISOString(),correctionEvidence:{lastHumanAt:row.lastHumanAt||null,lastHumanText:row.lastHumanText||null}};await this.store.saveLiveDailyObservation(obs.id,patch);corrected.push({...obs,...patch})}
      }
    }
    return{created,corrected,notCorrected};
  }

  async reconcileOverdueDeals(cfg,{now,date,activeDeals=null}){
    const sellerKeys=(cfg.sellers||[]).map(norm),deals=activeDeals||await this.store.listActiveDeals(20000);
    const mine=deals.filter(d=>sellerKeys.includes(norm(d.snapshot?.owner||d.owner)));
    let baseline=await this.store.getLiveDailyBaseline(cfg.id);

    // First run for this supervision group: snapshot the historical overdue backlog.
    // Existing overdue deals belong to Recovery and MUST NOT create hundreds of new supervisor corrections.
    if(!baseline){
      const historical={};
      for(const d of mine){
        const snap=d.snapshot||d,st=stage(snap.stageNorm||snap.stage),due=snap.dueDate?new Date(snap.dueDate):null;
        if(ACTIVE_OVERDUE_STAGES.has(st)&&due&&Number.isFinite(due.getTime())&&due<now){
          historical[String(d.id)]={dueDate:snap.dueDate,stage:st,overdueDays:Math.floor((now-due)/86400000)};
        }
      }
      baseline={createdAt:now.toISOString(),historicalOverdue:historical};
      await this.store.saveLiveDailyBaseline(cfg.id,baseline);
    }

    const historicalIds=new Set(Object.keys(baseline.historicalOverdue||{}));
    const existing=await this.store.listLiveDailyObservationsForSellers(sellerKeys,2000);

    // One-time cleanup of observations created by 0.11.0/0.11.1 before the baseline existed.
    // They represent the same historical Recovery backlog and must not remain as live Supervisor pendings.
    for(const o of existing){
      if(o.source==='CRM_DUE_DATE'&&o.supervisorId===cfg.id&&historicalIds.has(String(o.dealId))&&!o.historicalBaseline){
        await this.store.saveLiveDailyObservation(o.id,{
          status:'BASELINED',
          historicalBaseline:true,
          baselinedAt:now.toISOString(),
          baselineReason:'Historical overdue backlog delegated to Recovery'
        });
        o.status='BASELINED';
        o.historicalBaseline=true;
      }
    }

    const open=existing.filter(o=>o.source==='CRM_DUE_DATE'&&OPEN_STATUSES.has(o.status)&&o.supervisorId===cfg.id&&!o.historicalBaseline);
    const seen=new Set(),created=[],updated=[],corrected=[];
    let historicalOpen=0,historicalRed=0;

    for(const d of mine){
      const snap=d.snapshot||d,st=stage(snap.stageNorm||snap.stage),due=snap.dueDate?new Date(snap.dueDate):null;
      if(!ACTIVE_OVERDUE_STAGES.has(st)||!due||!Number.isFinite(due.getTime())||due>=now)continue;
      const days=Math.floor((now-due)/86400000);

      // Historical debt remains visible only as a compact Recovery backlog metric.
      // If the deal leaves the overdue condition and later becomes overdue again, it becomes a new supervisor case.
      if(historicalIds.has(String(d.id))){
        historicalOpen++;
        if(days>=7)historicalRed++;
        continue;
      }

      const caseKey=snap.conversationId||`deal:${d.id}`,seller=snap.owner||'No detectado',sellerKey=norm(seller);
      seen.add(String(d.id));
      let obs=open.find(o=>String(o.dealId)===String(d.id));
      const severity=days>=7?'RED':'HIGH',reason=days>=7?`🔴 Trato vencido +${days} días en ${st}.`:`Trato vencido +${days} días en ${st}.`;
      if(!obs){
        obs={id:id('due_obs'),source:'CRM_DUE_DATE',supervisorId:cfg.id,seller,sellerKey,caseKey,conversationId:snap.conversationId||null,dealId:d.id,issueType:'OVERDUE_DEAL',severity,status:'PENDING',reason,expected:'Recontactar al cliente y actualizar la fecha de seguimiento o mover el trato a un estado comercial válido.',openedAt:now.toISOString(),lastSeenAt:now.toISOString(),dueDate:snap.dueDate,stage:st,overdueDays:days,lastSourceUpdatedAt:snap.updatedAt||d.sourceUpdatedAt||null,sourceDate:date,hubUrl:snap.conversationId?hubUrl(snap.conversationId):null};
        await this.store.saveLiveDailyObservation(obs.id,obs);created.push(obs);
      }else{
        const changed=String(snap.updatedAt||d.sourceUpdatedAt||'')!==String(obs.lastSourceUpdatedAt||'');
        const patch={severity,reason,lastSeenAt:now.toISOString(),dueDate:snap.dueDate,stage:st,overdueDays:days,lastSourceUpdatedAt:snap.updatedAt||d.sourceUpdatedAt||null};
        if(changed){patch.status='NOT_CORRECTED';patch.notCorrectedAt=now.toISOString();patch.attempts=Number(obs.attempts||0)+1}
        await this.store.saveLiveDailyObservation(obs.id,patch);updated.push({...obs,...patch});
      }
    }

    // Historical IDs that are now fixed are removed from baseline. If they later expire again,
    // they are treated as a brand-new supervisor violation.
    const historicalNext={...(baseline.historicalOverdue||{})};
    for(const dealId of Object.keys(historicalNext)){
      const d=mine.find(x=>String(x.id)===String(dealId));
      if(!d){delete historicalNext[dealId];continue}
      const snap=d.snapshot||d,st=stage(snap.stageNorm||snap.stage),due=snap.dueDate?new Date(snap.dueDate):null;
      const stillOverdue=ACTIVE_OVERDUE_STAGES.has(st)&&due&&Number.isFinite(due.getTime())&&due<now;
      if(!stillOverdue)delete historicalNext[dealId];
    }
    if(Object.keys(historicalNext).length!==historicalIds.size){
      await this.store.saveLiveDailyBaseline(cfg.id,{historicalOverdue:historicalNext});
    }

    for(const obs of open){
      if(seen.has(String(obs.dealId)))continue;
      const d=await this.store.getDealState(obs.dealId);
      if(!d)continue;
      const snap=d.snapshot||d,st=stage(snap.stageNorm||snap.stage),due=snap.dueDate?new Date(snap.dueDate):null;
      const fixed=!ACTIVE_OVERDUE_STAGES.has(st)||!due||!Number.isFinite(due.getTime())||due>=now;
      if(fixed){
        const patch={status:'CORRECTED',correctedAt:now.toISOString(),lastSeenAt:now.toISOString(),correctionEvidence:{stage:st,dueDate:snap.dueDate||null}};
        await this.store.saveLiveDailyObservation(obs.id,patch);corrected.push({...obs,...patch});
      }
    }
    return{created,updated,corrected,historicalOpen,historicalRed,baselineCreatedAt:baseline.createdAt};
  }

  buildTelegramReport(cfg,result,{now=new Date(),deliveryMode='DRY_RUN'}={}){
    const rows=result.cases||[],obs=(result.allObservations||[]).filter(o=>o.supervisorId===cfg.id&&!o.historicalBaseline&&o.status!=='BASELINED'&&o.status!=='SUPERSEDED'),day=result.date;
    const pending=obs.filter(o=>OPEN_STATUSES.has(o.status)),corrected=obs.filter(o=>o.status==='CORRECTED'&&String(o.correctedAt||'').startsWith(day)),notCorrected=obs.filter(o=>o.status==='NOT_CORRECTED');
    const red=pending.filter(o=>o.issueType==='OVERDUE_DEAL'&&o.severity==='RED');
    const reportCases=[...new Map((result.cases||[]).filter(row=>Number(row.inboundCount||0)>0).map(row=>[String(row.conversationId),row])).values()];
    const totals={
      clientChats:reportCases.length,
      responded:reportCases.filter(x=>x.humanResponded).length,
      noResponse:reportCases.filter(x=>x.noHumanResponse).length,
      late:reportCases.filter(x=>Number(x.lateCount||0)>0).length,
      noDiscovery:reportCases.filter(x=>x.operationalWithoutDiscovery).length,
      unexplored:reportCases.filter(x=>x.unexploredPotential).length
    };
    totals.good=reportCases.filter(row=>buildCommercialCase(row).quality==='BIEN_TRABAJADO').length;
    totals.review=reportCases.filter(row=>buildCommercialCase(row).quality==='REVISAR').length;
    totals.toCorrect=reportCases.filter(row=>buildCommercialCase(row).quality==='A_CORREGIR').length;
    const label=cfg.sellerLabel||cfg.name||cfg.sellers?.join(', ')||'Vendedor';
    const lines=[`📊 SUPERVISIÓN DIARIA EN VIVO — ${label}`,`Fecha ${day} · acumulado desde 09:00`,`Modo: ${deliveryMode}`,'',`Clientes del día: ${totals.clientChats}`,`Respondidos: ${totals.responded}`,`Sin respuesta humana: ${totals.noResponse}`,`Respuestas tarde: ${totals.late}`,`Bien trabajados: ${totals.good}`,`Revisar: ${totals.review}`,`A corregir: ${totals.toCorrect}`,`Operativas sin indagar: ${totals.noDiscovery}`,`Potencial no explorado: ${totals.unexplored}`,'',`🟠 Pendientes: ${pending.length}`,`✅ Corregidas hoy: ${corrected.length}`,`❌ No corregidas: ${notCorrected.length}`,`🔴 Nuevos tratos +7 días bajo Supervisor: ${red.length}`,`🧹 Backlog histórico en Recovery: ${result.observations?.overdue?.historicalOpen||0} (${result.observations?.overdue?.historicalRed||0} con +7 días)`];
    const newObs=[...(result.observations?.created||[]),...(result.observations?.overdue?.created||[])];
    if(newObs.length){lines.push('','🆕 NUEVOS CASOS');for(const o of newObs.slice(0,10)){if(o.issueType==='COMMERCIAL_CHAT_CASE'){const d=o.dimensions||{};const dimLines=[`Tiempo: ${d.responseTime?.label||'-'}`,`Calidad: ${d.responseQuality?.label||'-'}`,`Asesoramiento: ${d.advisory?.label||'-'}`,`Guía: ${d.guidance?.label||'-'}`,`Oportunidad: ${d.opportunity?.label||'-'}`,`Seguimiento: ${d.followUp?.label||'-'}`].join('\n');lines.push(`⚠️ CASO ${o.quality==='REVISAR'?'A REVISAR':'A CORREGIR'}\n${dimLines}\nEsperado: ${o.expected}\n${o.hubUrl||''}`.trim())}else lines.push(`${o.severity==='RED'?'🔴':'⚠️'} ${o.reason}\nEsperado: ${o.expected}\n${o.hubUrl||''}`.trim())}}
    const changes=[...(result.observations?.corrected||[]),...(result.observations?.overdue?.corrected||[])];
    if(changes.length){lines.push('','✅ CORREGIDAS DESDE EL ÚLTIMO CONTROL');for(const o of changes.slice(0,10))lines.push(`• ${o.issueType} — ${o.hubUrl||o.caseKey}`)}
    const fails=result.observations?.notCorrected||[];
    if(fails.length){lines.push('','❌ NO CORREGIDAS / REINCIDENCIAS');for(const o of fails.slice(0,10))lines.push(`• ${o.reason}\n${o.hubUrl||''}`.trim())}
    if(red.length){lines.push('','🚨 ALERTA ROJA +7 DÍAS');for(const o of red.slice(0,10))lines.push(`• ${o.reason}\n${o.hubUrl||`Deal ${o.dealId}`}`)}
    return{summary:{...totals,pending:pending.length,corrected:corrected.length,notCorrected:notCorrected.length,redOverdue:red.length,recoveryBacklog:Number(result.observations?.overdue?.historicalOpen||0),recoveryBacklogRed:Number(result.observations?.overdue?.historicalRed||0)},text:lines.join('\n')};
  }
}

module.exports={LiveDailySupervisor,ACTIVE_OVERDUE_STAGES,OPEN_STATUSES,argentinaDate,dayRange,issueMap,buildCommercialCase};
