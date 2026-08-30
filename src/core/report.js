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



function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtNumber(value){
  const n=Number(value||0);
  try{return new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(n)}catch{return String(n)}
}
function emailSection(title,body){
  return `<tr><td style="padding:0 0 18px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#ffffff;border:1px solid #e4e7ec;border-radius:12px"><tr><td style="padding:18px 20px 10px 20px;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:24px;font-weight:700;color:#101828">${title}</td></tr><tr><td style="padding:0 20px 18px 20px">${body}</td></tr></table></td></tr>`;
}
function metricCell(label,value,accent='#344054'){
  return `<td valign="top" width="25%" style="padding:8px"><div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;color:#667085">${escapeHtml(label)}</div><div style="margin-top:3px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;font-weight:700;color:${accent}">${escapeHtml(value)}</div></td>`;
}
function sellerTable(rows,columns){
  const head=columns.map(c=>`<th align="${c.align||'left'}" style="padding:9px 10px;border-bottom:1px solid #d0d5dd;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;color:#475467;font-weight:700">${escapeHtml(c.label)}</th>`).join('');
  const body=rows.map((row,i)=>`<tr>${columns.map(c=>`<td align="${c.align||'left'}" style="padding:9px 10px;border-bottom:${i===rows.length-1?'0':'1px solid #eaecf0'};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#101828">${c.render?c.render(row):escapeHtml(row[c.key]??'')}</td>`).join('')}</tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #eaecf0;border-radius:8px">${head?`<thead><tr>${head}</tr></thead>`:''}<tbody>${body}</tbody></table>`;
}
function formatEmailReport(r){
  const time=localTime(r.generatedAt,r.timezone);
  let date='';
  try{date=new Intl.DateTimeFormat('es-AR',{timeZone:r.timezone||'America/Argentina/Buenos_Aires',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(r.generatedAt))}catch{date=String(r.generatedAt||'').slice(0,10)}
  const topPortfolio=topBy(r.sellers,'activeDeals');
  const topOverdue=topBy(r.sellers,'overdueDeals');
  const allUpToDate=r.sellers.slice().sort((a,b)=>(b.upToDateDeals||0)-(a.upToDateDeals||0)||String(a.label).localeCompare(String(b.label)));
  const attention=attentionSellers(r.sellers);

  const attentionMetrics=`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${metricCell('Clientes esperando',fmtNumber(r.inbox.waiting),'#b42318')}${metricCell('Sin asignar',fmtNumber(r.inbox.pendingAssignment),'#b54708')}${metricCell('60+ min',fmtNumber(r.inbox.waitingBuckets.PLUS_60),'#b42318')}${metricCell('Mayor espera',humanDuration(r.inbox.maxWaitingMinutes),'#b42318')}</tr></table><div style="padding:8px 8px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#475467">15–29 min: <b>${fmtNumber(r.inbox.waitingBuckets.PLUS_15)}</b> &nbsp;&nbsp; 30–59 min: <b>${fmtNumber(r.inbox.waitingBuckets.PLUS_30)}</b></div>`;

  const portfolioMetrics=`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${metricCell('Total',fmtNumber(r.portfolio.total),'#101828')}${metricCell('🟢 Al día',fmtNumber(r.portfolio.upToDate),'#027a48')}${metricCell('🔴 Vencidos',fmtNumber(r.portfolio.overdue),'#b42318')}${metricCell('⚪ Sin fecha',fmtNumber(r.portfolio.noDueDate),'#667085')}</tr></table>`;

  const topTable=sellerTable(topPortfolio.map((s,i)=>({rank:i+1,name:cleanSellerLabel(s.label),value:s.activeDeals})),[
    {label:'#',key:'rank',align:'center'},{label:'Vendedor / cuenta',key:'name'},{label:'Vigentes',key:'value',align:'right',render:x=>`<b>${fmtNumber(x.value)}</b>`}
  ]);
  const overdueTable=sellerTable(topOverdue.map((s,i)=>({rank:i+1,name:cleanSellerLabel(s.label),value:s.overdueDeals})),[
    {label:'#',key:'rank',align:'center'},{label:'Vendedor / cuenta',key:'name'},{label:'Vencidos',key:'value',align:'right',render:x=>`<b style="color:#b42318">${fmtNumber(x.value)}</b>`}
  ]);
  const upToDateTable=sellerTable(allUpToDate.map(s=>({name:cleanSellerLabel(s.label),up:s.upToDateDeals||0,total:s.activeDeals||0})),[
    {label:'Vendedor / cuenta',key:'name'},
    {label:'Al día',key:'up',align:'right',render:x=>`<b style="color:#027a48">${fmtNumber(x.up)}</b>`},
    {label:'Vigentes',key:'total',align:'right',render:x=>fmtNumber(x.total)}
  ]);
  const attentionTable=attention.length?sellerTable(attention.map(s=>({name:cleanSellerLabel(s.label),vig:s.activeDeals||0,up:s.upToDateDeals||0,over:s.overdueDeals||0,waiting:s.waiting||0,hunter:s.hunterToday||0,status:s.activity})),[
    {label:'Vendedor / cuenta',key:'name'},
    {label:'Vigentes',key:'vig',align:'right'},
    {label:'Al día',key:'up',align:'right',render:x=>`<span style="color:#027a48;font-weight:700">${fmtNumber(x.up)}</span>`},
    {label:'Vencidos',key:'over',align:'right',render:x=>`<span style="color:#b42318;font-weight:700">${fmtNumber(x.over)}</span>`},
    {label:'Esperando',key:'waiting',align:'right'},
    {label:'Hunter hoy',key:'hunter',align:'right'},
    {label:'Estado',key:'status',render:x=>x.status==='ACTIVO'?'<b style="color:#027a48">● ACTIVO</b>':'<b style="color:#b42318">● INACTIVO</b>'}
  ]):'<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#667085">Sin vendedores para destacar.</div>';

  const followMetrics=`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${metricCell('Vencidos',fmtNumber(r.followUps.total),'#b42318')}${metricCell('<15 días',fmtNumber(r.followUps.DUE),'#344054')}${metricCell('15–29 días',fmtNumber(r.followUps.PLUS_15),'#b54708')}${metricCell('30–59 días',fmtNumber(r.followUps.PLUS_30),'#b42318')}</tr><tr>${metricCell('60+ días',fmtNumber(r.followUps.PLUS_60),'#7a271a')}<td colspan="3"></td></tr></table>`;
  const eventMetrics=`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${metricCell('🔥 Nuevos HORNO',fmtNumber(r.events.HORNO),'#b54708')}${metricCell('🏆 Nuevos GANADO',fmtNumber(r.events.GANADO),'#027a48')}${metricCell('📣 Desde publicidad',fmtNumber(r.events.GANADO_FROM_AD),'#175cd3')}<td width="25%"></td></tr></table>`;

  const sections=[
    emailSection('🚨 ATENCIÓN AHORA',attentionMetrics),
    emailSection('📊 CARTERA VIGENTE',portfolioMetrics),
    emailSection('🏅 TOP CARTERA',topTable),
    emailSection('🔴 MAYOR CARTERA VENCIDA',overdueTable),
    emailSection('🟢 CARTERA AL DÍA — TODOS',upToDateTable),
    emailSection('👥 REQUIEREN ATENCIÓN',attentionTable),
    emailSection('📅 SEGUIMIENTOS CRM',followMetrics),
    emailSection('🔥 OPORTUNIDADES Y GANADOS',eventMetrics)
  ].join('');

  return `<!doctype html><html><body style="margin:0;padding:0;background:#f2f4f7"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f4f7"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="900" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:900px"><tr><td style="padding:0 4px 20px 4px"><div style="font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:34px;font-weight:700;color:#101828">SUPERVISOR SCB</div><div style="margin-top:5px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#667085">Reporte general · ${escapeHtml(date)} · ${escapeHtml(time)}</div></td></tr>${sections}<tr><td style="padding:2px 4px 20px 4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;color:#98a2b3">Generado automáticamente por SUPERVISOR SCB V3. Fuentes operativas en modo solo lectura.</td></tr></table></td></tr></table></body></html>`;
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
  r.html=formatEmailReport(r);
  return r;
}

module.exports={buildReport,formatReport,formatEmailReport,aggregateFollowUps,aggregatePortfolio,waitingBuckets,humanDuration,cleanSellerLabel,attentionSellers};
