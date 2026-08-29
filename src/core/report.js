function aggregateFollowUps(rows){
  const o={total:0,DUE:0,PLUS_15:0,PLUS_30:0,PLUS_60:0,bySeller:{}};
  for(const r of rows||[]){
    if(!r.followUp?.tracked)continue;
    o.total++;
    o[r.followUp.bucket]=(o[r.followUp.bucket]||0)+1;
    const s=r.followUp.seller||'unknown';
    o.bySeller[s]||={total:0,DUE:0,PLUS_15:0,PLUS_30:0,PLUS_60:0};
    o.bySeller[s].total++;
    o.bySeller[s][r.followUp.bucket]++;
  }
  return o;
}

function aggregatePortfolio(rows){
  const o={total:0,upToDate:0,overdue:0,noDueDate:0,bySeller:{},bySellerBreakdown:{}};
  for(const r of rows||[]){
    if(r.portfolio?.active!==true)continue;
    o.total++;
    const s=r.snapshot?.owner||'unknown';
    o.bySeller[s]=(o.bySeller[s]||0)+1;
    o.bySellerBreakdown[s]||={total:0,upToDate:0,overdue:0,noDueDate:0};
    o.bySellerBreakdown[s].total++;
    if(r.portfolio?.upToDate===true){o.upToDate++;o.bySellerBreakdown[s].upToDate++}
    else if(r.portfolio?.overdue===true){o.overdue++;o.bySellerBreakdown[s].overdue++}
    else{o.noDueDate++;o.bySellerBreakdown[s].noDueDate++}
  }
  return o;
}

function waitingBuckets(rows){
  const o={LT15:0,PLUS_15:0,PLUS_30:0,PLUS_60:0,bySeller:{}};
  for(const r of rows||[]){
    const m=Math.max(0,Number(r.metrics?.waitingMinutes||0));
    const seller=r.metrics?.owner||'unknown';
    let b='LT15';
    if(m>=60)b='PLUS_60';else if(m>=30)b='PLUS_30';else if(m>=15)b='PLUS_15';
    o[b]++;
    o.bySeller[seller]||={total:0,LT15:0,PLUS_15:0,PLUS_30:0,PLUS_60:0};
    o.bySeller[seller].total++;
    o.bySeller[seller][b]++;
  }
  return o;
}

function humanDuration(mins){
  const n=Math.max(0,Math.round(Number(mins||0)));
  if(n<60)return`${n} min`;
  const h=Math.floor(n/60),m=n%60;
  if(h<24)return`${h} h${m?` ${m} min`:''}`;
  const d=Math.floor(h/24),rh=h%24;
  return`${d} d${rh?` ${rh} h`:''}${m?` ${m} min`:''}`;
}

function sellerKey(v){return String(v||'').trim().toLowerCase()||'unknown'}

function cleanSellerLabel(value){
  let s=String(value||'').trim();
  if(!s)return'Unknown';
  if(s.includes('@')){
    const local=s.split('@')[0].replace(/[._-]+/g,' ').trim();
    if(local==='nqn')return'Cuenta NQN';
    if(local==='rj'||local==='lr')return'Cuenta LR';
    if(local==='sj')return'Cuenta SJ';
    if(local==='jujuy')return'Cuenta Jujuy';
    if(local==='catamarca')return'Cuenta Catamarca';
    if(local==='mendoza')return'Cuenta Mendoza';
    if(local==='salta')return'Cuenta Salta';
    if(local==='tandil')return'Cuenta Tandil';
    if(local==='oficina caba')return'Oficina CABA';
    return local.replace(/\b\w/g,c=>c.toUpperCase());
  }
  s=s.replace(/^Agente\s+(?:AMBA|CORDOBA|CÓRDOBA|NQN|LR|SANTA FE|TANDIL|MISIONES)\s+/i,'').replace(/\s+/g,' ').trim();
  return s||String(value||'').trim();
}

function localTime(iso,timezone='America/Argentina/Buenos_Aires'){
  const d=new Date(iso);
  try{return new Intl.DateTimeFormat('es-AR',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hour12:false}).format(d)}catch{return String(iso||'').slice(11,16)}
}

function topBy(sellers,key,limit=5,filter=x=>x[key]>0){
  return sellers.filter(filter).slice().sort((a,b)=>(b[key]||0)-(a[key]||0)||String(a.label).localeCompare(String(b.label))).slice(0,limit);
}

function pushRanking(lines,title,rows,key,suffix=''){
  lines.push('',title,'');
  if(!rows.length){lines.push('Sin datos');return}
  rows.forEach((s,i)=>lines.push(`${i+1}. ${cleanSellerLabel(s.label)} — ${s[key]}${suffix}`));
}

function attentionScore(s){
  return (s.waiting||0)*1000+(s.hunterLast30m||0)*500+(s.activity==='ACTIVO'?250:0)+(s.overdueDeals||0);
}

function attentionSellers(sellers,limit=10){
  return sellers.filter(s=>s.waiting>0||s.hunterLast30m>0||s.activity==='ACTIVO'||(s.activeDeals>0&&s.overdueDeals>0))
    .slice().sort((a,b)=>attentionScore(b)-attentionScore(a)||b.activeDeals-a.activeDeals).slice(0,limit);
}

function formatReport(r){
  const L=[];
  const time=localTime(r.generatedAt,r.timezone);
  L.push(`SUPERVISOR SCB — ${time}`,'');

  L.push('🚨 ATENCIÓN AHORA','');
  L.push(`Clientes esperando: ${r.inbox.waiting}`);
  L.push(`Sin asignar: ${r.inbox.pendingAssignment}`);
  L.push(`15–29 min: ${r.inbox.waitingBuckets.PLUS_15}`);
  L.push(`30–59 min: ${r.inbox.waitingBuckets.PLUS_30}`);
  L.push(`60+ min: ${r.inbox.waitingBuckets.PLUS_60}`);
  L.push(`Mayor espera: ${humanDuration(r.inbox.maxWaitingMinutes)}`);

  L.push('','📊 CARTERA VIGENTE','');
  L.push(`Total: ${r.portfolio.total}`);
  L.push(`🟢 Al día: ${r.portfolio.upToDate}`);
  L.push(`🔴 Vencidos: ${r.portfolio.overdue}`);
  L.push(`⚪ Sin fecha: ${r.portfolio.noDueDate}`);

  pushRanking(L,'🏅 TOP CARTERA',topBy(r.sellers,'activeDeals'),'activeDeals');
  pushRanking(L,'🔴 MAYOR CARTERA VENCIDA',topBy(r.sellers,'overdueDeals'),'overdueDeals');
  L.push('','🟢 CARTERA AL DÍA','');
  const allUpToDate=r.sellers.slice().sort((a,b)=>(b.upToDateDeals||0)-(a.upToDateDeals||0)||String(a.label).localeCompare(String(b.label)));
  if(!allUpToDate.length)L.push('Sin datos');
  else allUpToDate.forEach(s=>L.push(`${cleanSellerLabel(s.label)} — ${s.upToDateDeals||0} al día / ${s.activeDeals||0} vigentes`));

  L.push('','👥 REQUIEREN ATENCIÓN','');
  const attention=attentionSellers(r.sellers);
  if(!attention.length)L.push('Sin vendedores para destacar.');
  for(const s of attention){
    L.push(cleanSellerLabel(s.label));
    L.push(`${s.activeDeals} vigentes · ${s.upToDateDeals} al día · ${s.overdueDeals} vencidos`);
    L.push(`${s.waiting} esperando · Hunter hoy ${s.hunterToday} · ${s.activity==='ACTIVO'?'🟢 ACTIVO':'🔴 INACTIVO'}`);
    L.push('');
  }

  L.push('📅 SEGUIMIENTOS CRM','');
  L.push(`Vencidos: ${r.followUps.total}`);
  L.push(`<15 días: ${r.followUps.DUE}`);
  L.push(`15–29 días: ${r.followUps.PLUS_15}`);
  L.push(`30–59 días: ${r.followUps.PLUS_30}`);
  L.push(`60+ días: ${r.followUps.PLUS_60}`);

  L.push('','🔥 OPORTUNIDADES','');
  L.push(`Nuevos HORNO: ${r.events.HORNO}`);

  L.push('','🏆 GANADOS','');
  L.push(`Nuevos GANADO: ${r.events.GANADO}`);
  L.push(`Desde publicidad: ${r.events.GANADO_FROM_AD}`);

  return L.join('\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,4090);
}

function buildReport({runId,now,inbox,hunterBySeller,followUpRows,activeDealRows,waitingRows,conversationRows,events,sellerLabels,sellerRoster=[],timezone='America/Argentina/Buenos_Aires'}){
  const followUps=aggregateFollowUps(followUpRows),portfolio=aggregatePortfolio(activeDealRows),wait=waitingBuckets(waitingRows);
  const sellerMap=new Map();
  const ensure=(id,label)=>{
    const k=sellerKey(id);
    if(!sellerMap.has(k))sellerMap.set(k,{id:k,label:label||id||k,hunterLast30m:0,hunterToday:0,lastActivityAt:null,activeDeals:0,upToDateDeals:0,overdueDeals:0,noDueDateDeals:0,waiting:0,followUps:0,activity:'INACTIVO'});
    else if(label&&sellerMap.get(k).label===k)sellerMap.get(k).label=label;
    return sellerMap.get(k);
  };
  for(const s of sellerRoster)ensure(s.id,s.label);
  for(const [id,h] of hunterBySeller.entries()){
    const s=ensure(id,sellerLabels.get(id)||id);
    s.hunterLast30m=h.managementsLast30Minutes||0;s.hunterToday=h.managements||0;s.lastActivityAt=h.lastActivityAt||s.lastActivityAt;
  }
  for(const [owner,x] of Object.entries(portfolio.bySellerBreakdown)){
    const mapped=sellerRoster.find(x=>sellerKey(x.raw)===sellerKey(owner)||sellerKey(x.email)===sellerKey(owner));
    const s=ensure(mapped?.id||owner,mapped?.label||owner);
    s.activeDeals+=x.total;s.upToDateDeals+=x.upToDate;s.overdueDeals+=x.overdue;s.noDueDateDeals+=x.noDueDate;
  }
  for(const [owner,x] of Object.entries(wait.bySeller)){
    const mapped=sellerRoster.find(x=>sellerKey(x.raw)===sellerKey(owner)||sellerKey(x.email)===sellerKey(owner));
    ensure(mapped?.id||owner,mapped?.label||owner).waiting+=x.total;
  }
  for(const [owner,x] of Object.entries(followUps.bySeller)){
    const mapped=sellerRoster.find(x=>sellerKey(x.raw)===sellerKey(owner)||sellerKey(x.email)===sellerKey(owner));
    ensure(mapped?.id||owner,mapped?.label||owner).followUps+=x.total;
  }
  for(const c of conversationRows||[]){
    const owner=c.metrics?.owner;if(!owner||!c.metrics?.lastSellerActivityAt)continue;
    const mapped=sellerRoster.find(x=>sellerKey(x.raw)===sellerKey(owner)||sellerKey(x.email)===sellerKey(owner));
    const s=ensure(mapped?.id||owner,mapped?.label||owner),iso=c.metrics.lastSellerActivityAt;
    if(!s.lastActivityAt||iso>s.lastActivityAt)s.lastActivityAt=iso;
  }
  const activeWindowMs=45*60000;
  for(const s of sellerMap.values()){
    const t=s.lastActivityAt?new Date(s.lastActivityAt):null;
    s.activity=(s.hunterLast30m>0||(t&&now-t<=activeWindowMs&&now>=t))?'ACTIVO':'INACTIVO';
  }
  const sellers=[...sellerMap.values()].filter(s=>s.activeDeals||s.waiting||s.followUps||s.hunterToday||s.lastActivityAt).sort((a,b)=>b.activeDeals-a.activeDeals||b.hunterToday-a.hunterToday||String(a.label).localeCompare(String(b.label)));
  const ev={HORNO:0,GANADO:0,GANADO_FROM_AD:0};
  for(const e of events||[])if(ev[e.type]!==undefined)ev[e.type]++;
  const r={runId,generatedAt:now.toISOString(),timezone,inbox:{...inbox,waitingBuckets:wait},portfolio,followUps,sellers,events:ev};
  r.text=formatReport(r);
  return r;
}

module.exports={buildReport,formatReport,aggregateFollowUps,aggregatePortfolio,waitingBuckets,humanDuration,cleanSellerLabel,attentionSellers};
