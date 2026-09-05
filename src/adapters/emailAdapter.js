function clean(value){return String(value||'').trim()}
function stripTrailingSlash(value){return clean(value).replace(/\/+$/,'')}
function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function textToHtml(text){return `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.45">${escapeHtml(text)}</div>`}
class EmailAdapter{
  constructor(env=process.env,fetchImpl=global.fetch){
    this.baseUrl=stripTrailingSlash(env.EMAIL_SERVICE_URL);
    this.systemToken=clean(env.EMAIL_SYSTEM_TOKEN);
    this.accountKey=clean(env.EMAIL_ACCOUNT_KEY);
    this.to=clean(env.SUPERVISOR_REPORT_EMAIL_TO);
    this.fetch=fetchImpl;
  }
  isConfigured(){return!!(this.baseUrl&&this.systemToken&&this.accountKey&&this.to)}
  configStatus(){return{serviceUrlConfigured:!!this.baseUrl,systemTokenConfigured:!!this.systemToken,accountKeyConfigured:!!this.accountKey,recipientConfigured:!!this.to,configured:this.isConfigured(),accountKey:this.accountKey||null,recipient:this.to||null}}
  async validateService(){
    if(!this.baseUrl)throw new Error('EMAIL_SERVICE_URL_NOT_CONFIGURED');
    const r=await this.fetch(`${this.baseUrl}/api/health`,{method:'GET'});
    let data={};try{data=await r.json()}catch{}
    if(!r.ok||data.ok===false)throw new Error(`EMAIL_SERVICE_UNAVAILABLE:${data.error||r.status}`);
    return{ok:true,connectivity:true,service:data.service||data.app||'mrapi-email',version:data.version||null,configuration:this.configStatus(),note:'La conectividad está validada. Token de sistema, accountKey y SMTP se validan con Probar Email.'};
  }
  async send({subject,bodyText,bodyHtml,operationId,source='supervisor-scb',to=null}){
    const recipient=clean(to)||this.to;
    if(!(this.baseUrl&&this.systemToken&&this.accountKey&&recipient))throw new Error('EMAIL_NOT_CONFIGURED');
    const payload={accountKey:this.accountKey,to:recipient,subject:clean(subject)||'SUPERVISOR SCB',bodyText:String(bodyText||''),bodyHtml:String(bodyHtml||textToHtml(bodyText||'')),source,operationId:clean(operationId)};
    const r=await this.fetch(`${this.baseUrl}/api/system/send-email`,{method:'POST',headers:{'content-type':'application/json','x-system-token':this.systemToken},body:JSON.stringify(payload)});
    let data={};try{data=await r.json()}catch{}
    if(!r.ok||!data.ok)throw new Error(`EMAIL_SEND_FAILED:${data.error||r.status}`);
    return{ok:true,logId:data.logId||null,messageId:data.messageId||null,accountId:data.accountId||null,accountKey:data.accountKey||this.accountKey,imapSaved:!!data.imapSaved,to:recipient};
  }
}
module.exports={EmailAdapter,textToHtml};
