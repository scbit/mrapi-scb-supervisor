
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

    const cases=(await this.store.listLiveDailyCases(date,sellerKeys,2000)).filter(x=>!x.row?.excludedFromReport).map(x=>x.row);
    const observations=await this.reconcileConversationObservations(cfg,cases,{now,date});
    const overdue=await this.reconcileOverdueDeals(cfg,{now,date,activeDeals});
    const allObs=await this.store.listLiveDailyObservationsForSellers(sellerKeys,2000);
    const groupObs=allObs.filter(o=>sellerKeys.includes(norm(o.sellerKey||o.seller)));
    const dailySummary=summary(cases);
    return{date,cases,changedCases,bySeller:dailySummary,observations:{...observations,overdue},allObservations:groupObs};
  }

  async reconcileConversationObservations(cfg,cases,{now,date}){
    const sellerKeys=(cfg.sellers||[]).map(norm),existing=await this.store.listLiveDailyObservationsForSellers(sellerKeys,2000),byCase=new Map();
    for(const o of existing.filter(o=>o.source==='DAILY_V3'&&OPEN_STATUSES.has(o.status))) {
      const k=String(o.caseKey);if(!byCase.has(k))byCase.set(k,[]);byCase.get(k).push(o);
    }
    const created=[],corrected=[],notCorrected=[];

    for(const row of cases){
      const caseKey=row.conversationId,issues=issueMap(row),open=byCase.get(String(caseKey))||[];
      for(const [issueType,issue] of issues){
        let obs=open.find(o=>o.issueType===issueType);
        if(!obs){
          obs={id:id('daily_obs'),source:'DAILY_V3',supervisorId:cfg.id,seller:row.seller||row.owner,sellerKey:norm(row.seller||row.owner),caseKey,conversationId:row.conversationId,dealId:row.dealId||null,issueType,severity:issue.severity,status:'PENDING',reason:issue.reason,expected:issue.expected,openedAt:now.toISOString(),lastSeenAt:now.toISOString(),lastHumanAtAtDetection:row.lastHumanAt||null,lastEvidenceFingerprint:`${row.lastClientAt||''}|${row.lastHumanAt||''}|${issueType}`,sourceDate:date,hubUrl:row.hubUrl};
          await this.store.saveLiveDailyObservation(obs.id,obs);created.push(obs);open.push(obs);
        }else{
          const newHuman=!!row.lastHumanAt&&!!obs.lastHumanAtAtDetection&&new Date(row.lastHumanAt)>new Date(obs.lastHumanAtAtDetection);
          const patch={lastSeenAt:now.toISOString(),severity:issue.severity,reason:issue.reason,expected:issue.expected};
          if(newHuman&&obs.status!=='NOT_CORRECTED'){patch.status='NOT_CORRECTED';patch.lastHumanAtAtDetection=row.lastHumanAt;patch.notCorrectedAt=now.toISOString();patch.attempts=Number(obs.attempts||0)+1;notCorrected.push({...obs,...patch})}
          await this.store.saveLiveDailyObservation(obs.id,patch);
        }
      }

      for(const obs of open){
        if(!OPEN_STATUSES.has(obs.status)||issues.has(obs.issueType))continue;
        const hasNewHuman=!!row.lastHumanAt&&(!obs.lastHumanAtAtDetection||new Date(row.lastHumanAt)>new Date(obs.lastHumanAtAtDetection));
        if(hasNewHuman || obs.issueType==='NO_HUMAN_RESPONSE'){
          const patch={status:'CORRECTED',correctedAt:now.toISOString(),lastSeenAt:now.toISOString(),correctionEvidence:{lastHumanAt:row.lastHumanAt||null,lastHumanText:row.lastHumanText||null}};
          await this.store.saveLiveDailyObservation(obs.id,patch);corrected.push({...obs,...patch});
        }
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
    const rows=result.cases||[],obs=(result.allObservations||[]).filter(o=>o.supervisorId===cfg.id&&!o.historicalBaseline&&o.status!=='BASELINED'),day=result.date;
    const pending=obs.filter(o=>OPEN_STATUSES.has(o.status)),corrected=obs.filter(o=>o.status==='CORRECTED'&&String(o.correctedAt||'').startsWith(day)),notCorrected=obs.filter(o=>o.status==='NOT_CORRECTED');
    const red=pending.filter(o=>o.issueType==='OVERDUE_DEAL'&&o.severity==='RED');
    const s=result.bySeller||[];
    const totals=s.reduce((a,x)=>{a.clientChats+=Number(x.clientChats||0);a.responded+=Number(x.respondedClientChats||0);a.noResponse+=Number(x.noHumanResponse||0);a.late+=Number(x.late||0);a.good+=Number(x.goodCommercial||0);a.noDiscovery+=Number(x.operationalWithoutDiscovery||0);a.unexplored+=Number(x.unexploredPotential||0);return a},{clientChats:0,responded:0,noResponse:0,late:0,good:0,noDiscovery:0,unexplored:0});
    const label=cfg.sellerLabel||cfg.name||cfg.sellers?.join(', ')||'Vendedor';
    const lines=[`📊 SUPERVISIÓN DIARIA EN VIVO — ${label}`,`Fecha ${day} · acumulado desde 09:00`,`Modo: ${deliveryMode}`,'',`Clientes del día: ${totals.clientChats}`,`Respondidos: ${totals.responded}`,`Sin respuesta humana: ${totals.noResponse}`,`Respuestas tarde: ${totals.late}`,`Buenas respuestas comerciales: ${totals.good}`,`Operativas sin indagar: ${totals.noDiscovery}`,`Potencial no explorado: ${totals.unexplored}`,'',`🟠 Pendientes: ${pending.length}`,`✅ Corregidas hoy: ${corrected.length}`,`❌ No corregidas: ${notCorrected.length}`,`🔴 Nuevos tratos +7 días bajo Supervisor: ${red.length}`,`🧹 Backlog histórico en Recovery: ${result.observations?.overdue?.historicalOpen||0} (${result.observations?.overdue?.historicalRed||0} con +7 días)`];
    const newObs=[...(result.observations?.created||[]),...(result.observations?.overdue?.created||[])];
    if(newObs.length){lines.push('','🆕 NUEVOS CASOS');for(const o of newObs.slice(0,10))lines.push(`${o.severity==='RED'?'🔴':'⚠️'} ${o.reason}\nEsperado: ${o.expected}\n${o.hubUrl||''}`.trim())}
    const changes=[...(result.observations?.corrected||[]),...(result.observations?.overdue?.corrected||[])];
    if(changes.length){lines.push('','✅ CORREGIDAS DESDE EL ÚLTIMO CONTROL');for(const o of changes.slice(0,10))lines.push(`• ${o.issueType} — ${o.hubUrl||o.caseKey}`)}
    const fails=result.observations?.notCorrected||[];
    if(fails.length){lines.push('','❌ NO CORREGIDAS / REINCIDENCIAS');for(const o of fails.slice(0,10))lines.push(`• ${o.reason}\n${o.hubUrl||''}`.trim())}
    if(red.length){lines.push('','🚨 ALERTA ROJA +7 DÍAS');for(const o of red.slice(0,10))lines.push(`• ${o.reason}\n${o.hubUrl||`Deal ${o.dealId}`}`)}
    return{summary:{...totals,pending:pending.length,corrected:corrected.length,notCorrected:notCorrected.length,redOverdue:red.length,recoveryBacklog:Number(result.observations?.overdue?.historicalOpen||0),recoveryBacklogRed:Number(result.observations?.overdue?.historicalRed||0)},text:lines.join('\n')};
  }
}

module.exports={LiveDailySupervisor,ACTIVE_OVERDUE_STAGES,OPEN_STATUSES,argentinaDate,dayRange,issueMap};
