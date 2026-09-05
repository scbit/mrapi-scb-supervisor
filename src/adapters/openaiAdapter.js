class OpenAIAdapter{
  constructor(env=process.env){this.apiKey=env.OPENAI_API_KEY||'';this.model=env.OPENAI_MODEL||'gpt-4.1-mini'}
  isConfigured(){return!!(this.apiKey&&this.model)}
  configStatus(){return{configured:this.isConfigured(),model:this.model||null}}
  buildTranscript(messages=[]){return messages.map((m,i)=>{const actor=m.actor==='client'?'CLIENTE':m.actor==='human'?'VENDEDOR HUMANO':m.actor==='bot'?'BOT':'SALIDA';const user=m.actor==='human'&&m.user?` (${m.user})`:'';return`${i+1}. [${m.timestamp||''}] ${actor}${user}: ${String(m.text||'').replace(/\s+/g,' ').trim()}`}).join('\n')}
  async analyzeConversation(conversation,messages=[]){
    if(!this.apiKey)throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
    const transcript=this.buildTranscript(messages).slice(0,20000);
    const prompt=`Sos supervisor comercial de Sentire Customs Broker / SCB.
Tu tarea es hacer un diagnóstico comercial práctico del chat, separando CLIENTE, BOT y VENDEDOR HUMANO.
No seas alarmista y no evalúes solo si respondió: evaluá si el vendedor realmente vendió de forma consultiva.

Objetivo principal de este análisis:
Detectar si el vendedor indagó el negocio real del cliente o si respondió de forma operativa sin descubrir potencial comercial.
Un cliente puede preguntar por una caja, pero en realidad puede ser importador, distribuidor, comercio, fábrica o comprador recurrente con miedo de importar.
El vendedor debe descubrir eso antes de tratarlo como una consulta chica.

Contexto SCB:
- SCB vende servicios de importación, flete marítimo/aéreo/courier, despacho de aduana, consolidación y búsqueda de productos.
- Una buena respuesta no es solo pedir peso, medidas y FOB. También debe descubrir el negocio del cliente.
- Datos operativos importantes: producto, cantidad, origen, destino, medidas/peso, valor FOB, modalidad aérea/marítima/courier, datos de contacto.
- Datos comerciales importantes: si es para uso propio o reventa, si ya importa, si es distribuidor/comercio/fábrica, volumen potencial, frecuencia de compra, miedo u objeción principal, si necesita proveedor, si quiere prueba o compra recurrente.

Evaluá especialmente:
1. Si el bot respondió y si hizo falta intervención humana.
2. Si el vendedor humano respondió con tono profesional, práctico y comercial.
3. Si pidió datos operativos necesarios.
4. Si indagó el negocio real del cliente.
5. Si preguntó si el cliente ya importa o si tiene miedo/objeciones para importar.
6. Si preguntó volumen potencial, recurrencia o si es para reventa/distribución.
7. Si detectó perfil del cliente: importador, distribuidor, comercio, fábrica, consumidor final, desconocido.
8. Si el vendedor trató una oportunidad potencial como una consulta chica.
9. Si hay oportunidad comercial activa y próxima acción concreta.
10. Si hay una respuesta incorrecta, confusa o que conviene revisar.

Criterio comercial:
- Si el vendedor solo pide datos técnicos/operativos y no pregunta nada del negocio, marcá commercial_discovery_level = bajo o nulo.
- Si pregunta para qué lo quiere, si vende, si importa, volumen o recurrencia, marcá nivel medio/alto según profundidad.
- No castigues al vendedor si solo respondió el bot y todavía no intervino humano; en ese caso indicá que falta intervención humana.
- Sé concreto: decí qué pregunta exacta debería haber hecho el vendedor.

Conversación:
ID: ${conversation.id}
Contacto: ${conversation.contactName||'sin nombre'}
Teléfono: ${conversation.phone||'sin teléfono'}
Deal: ${conversation.dealId||'sin deal'}
Stage: ${conversation.stage||'sin stage'}
Origen: ${conversation.sourceChannel||'sin origen'}
Anuncio: ${conversation.adTitle||'sin anuncio'}

TRANSCRIPCIÓN:
${transcript}

Devolvé SOLO JSON válido con esta estructura:
{
  "overall_score": 0,
  "result": "bien",
  "seller_detected": null,
  "customer_intent": "",
  "summary": "",
  "good_points": [],
  "bad_points": [],
  "missed_opportunities": [],
  "next_best_reply": "",
  "risk_level": "bajo",
  "should_alert_owner": false,
  "commercial_discovery_level": "medio",
  "did_ask_business_context": false,
  "did_ask_import_experience": false,
  "did_ask_volume_potential": false,
  "did_detect_customer_profile": false,
  "customer_profile_guess": "desconocido",
  "missed_discovery_questions": [],
  "commercial_risk": "bajo",
  "sales_coaching": "",
  "operational_without_discovery": false,
  "unexplored_potential": false
}`;
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${this.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:this.model,input:[{role:'system',content:'Respondé únicamente JSON válido. No agregues markdown.'},{role:'user',content:prompt}]})});
    const raw=await response.text();if(!response.ok)throw new Error(`OpenAI error ${response.status}: ${raw}`);
    const data=JSON.parse(raw);const outputText=data.output_text||data.output?.flatMap(o=>o.content||[]).find(c=>c.type==='output_text')?.text||'';if(!outputText)throw new Error('OpenAI no devolvió texto.');return JSON.parse(outputText.replace(/^```json/i,'').replace(/^```/i,'').replace(/```$/i,'').trim());
  }
  async verifyCorrection({action,message,conversation}){
    if(!this.apiKey)throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
    const prompt=`Sos verificador de cumplimiento comercial de SCB. Evaluá SOLO si la siguiente intervención del vendedor cumple la corrección solicitada. No evalúes la calidad general del chat.\n\nACCIÓN: ${action.actionType}\nMOTIVO: ${action.reason||''}\nCOMPORTAMIENTO ESPERADO: ${action.expectedBehavior||''}\nRÚBRICA:\n${(action.rubric||[]).map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\nCLIENTE: ${conversation?.contactName||'sin nombre'}\nMENSAJE DEL VENDEDOR: ${String(message?.text||'')}\n\nDevolvé SOLO JSON válido: {"verified":true,"score":0,"reason":"","criteria":[{"criterion":"","met":true}],"evidenceMessageId":"${message?.id||''}","evidenceAt":"${message?.timestamp||''}"}`;
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${this.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:this.model,input:[{role:'system',content:'Respondé únicamente JSON válido.'},{role:'user',content:prompt}]})});
    const raw=await response.text();if(!response.ok)throw new Error(`OpenAI error ${response.status}: ${raw}`);const data=JSON.parse(raw);const outputText=data.output_text||data.output?.flatMap(o=>o.content||[]).find(c=>c.type==='output_text')?.text||'';if(!outputText)throw new Error('OpenAI no devolvió texto.');const out=JSON.parse(outputText.replace(/^```json/i,'').replace(/^```/i,'').replace(/```$/i,'').trim());return{verified:out.verified===true,score:Number(out.score||0),reason:String(out.reason||''),criteria:Array.isArray(out.criteria)?out.criteria:[],evidenceMessageId:message?.id||null,evidenceAt:message?.timestamp||null};
  }

  async analyzeWeekendOpportunity({conversation,messages=[]}){
    if(!this.apiKey)throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
    const transcript=this.buildTranscript(messages).slice(0,12000);
    const prompt=`Sos guardia comercial de fin de semana de SCB. Analizá SOLO si este chat nuevo merece interrumpir al dueño durante el fin de semana.
Muchos chats llegan desde Meta Ads y pueden estar sin vendedor asignado: eso NO es una urgencia por sí mismo.
No uses la calidad oficial del CRM. Esta es una señal provisoria de oportunidad.

Alertar únicamente si hay:
- urgencia real;
- intención clara de avanzar/pagar/cerrar;
- volumen comercial fuerte;
- contenedores, compra recurrente o proveedor listo;
- problema operativo sensible;
- cliente muy molesto con riesgo real;
- oportunidad excepcional que no debería esperar al lunes.

No alertes consultas genéricas, curiosidad, primer "hola", pedido básico de precio o lead normal de Ads.

Conversación:
Cliente: ${conversation?.contactName||'sin nombre'}
Asignado: ${conversation?.owner||'NO'}
Origen: ${conversation?.sourceChannel||''}
Anuncio: ${conversation?.adTitle||''}

Mensajes recientes:
${transcript}

Devolvé SOLO JSON:
{"signal":"NORMAL|INTERESANTE|MUY_INTERESANTE|URGENTE|CRITICA","urgent":false,"summary":"","reason":""}`;
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${this.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:this.model,input:[{role:'system',content:'Respondé únicamente JSON válido.'},{role:'user',content:prompt}]})});
    const raw=await response.text();if(!response.ok)throw new Error(`OpenAI error ${response.status}: ${raw}`);const data=JSON.parse(raw);const outputText=data.output_text||data.output?.flatMap(o=>o.content||[]).find(c=>c.type==='output_text')?.text||'';if(!outputText)throw new Error('OpenAI no devolvió texto.');const out=JSON.parse(outputText.replace(/^```json/i,'').replace(/^```/i,'').replace(/```$/i,'').trim());return{signal:String(out.signal||'NORMAL').toUpperCase(),urgent:out.urgent===true,summary:String(out.summary||''),reason:String(out.reason||'')};
  }

}
module.exports={OpenAIAdapter};
