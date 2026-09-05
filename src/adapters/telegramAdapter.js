class TelegramAdapter{
  constructor(env=process.env,fetchImpl=global.fetch){this.token=String(env.TELEGRAM_BOT_TOKEN||'').trim();this.chatId=String(env.TELEGRAM_CHAT_ID||'').trim();this.fetch=fetchImpl}
  isConfigured(){return!!(this.token&&this.chatId)}
  split(text,max=3900){const raw=String(text||'');if(raw.length<=max)return[raw];const out=[];let rest=raw;while(rest.length){if(rest.length<=max){out.push(rest);break}let cut=rest.lastIndexOf('\n',max);if(cut<max*.6)cut=max;out.push(rest.slice(0,cut));rest=rest.slice(cut).replace(/^\n+/,'')}return out}
  async send(text,chatIdOverride=null){if(!this.token||!(chatIdOverride||this.chatId))throw new Error('TELEGRAM_NOT_CONFIGURED');const target=String(chatIdOverride||this.chatId);const url=`https://api.telegram.org/bot${this.token}/sendMessage`,ids=[];for(const part of this.split(text)){const r=await this.fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:target,text:part,disable_web_page_preview:true})});const data=await r.json();if(!r.ok||!data.ok)throw new Error(`TELEGRAM_SEND_FAILED:${data.description||r.status}`);ids.push(data.result?.message_id||null)}return{ok:true,messageId:ids.at(-1)||null,messageIds:ids,parts:ids.length,chatId:target}}
}
module.exports={TelegramAdapter};
