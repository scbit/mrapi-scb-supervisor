class TelegramAdapter{
  constructor(env=process.env,fetchImpl=global.fetch){this.token=String(env.TELEGRAM_BOT_TOKEN||'').trim();this.chatId=String(env.TELEGRAM_CHAT_ID||'').trim();this.fetch=fetchImpl}
  isConfigured(){return!!(this.token&&this.chatId)}
  split(text,max=3900){const raw=String(text||'');if(raw.length<=max)return[raw];const out=[];let rest=raw;while(rest.length){if(rest.length<=max){out.push(rest);break}let cut=rest.lastIndexOf('\n',max);if(cut<max*.6)cut=max;out.push(rest.slice(0,cut));rest=rest.slice(cut).replace(/^\n+/,'')}return out}
  async listRecentChats(){
    if(!this.token)throw new Error('TELEGRAM_NOT_CONFIGURED');
    const url=`https://api.telegram.org/bot${this.token}/getUpdates?limit=100&timeout=0`;
    const r=await this.fetch(url);const data=await r.json();if(!r.ok||!data.ok)throw new Error(`TELEGRAM_GET_UPDATES_FAILED:${data.description||r.status}`);
    const map=new Map();
    for(const u of data.result||[]){const chat=u.message?.chat||u.my_chat_member?.chat||u.channel_post?.chat;if(!chat)continue;map.set(String(chat.id),{chatId:String(chat.id),title:chat.title||[chat.first_name,chat.last_name].filter(Boolean).join(' ')||chat.username||String(chat.id),type:chat.type||'unknown'})}
    return [...map.values()].sort((a,b)=>a.title.localeCompare(b.title,'es',{sensitivity:'base'}));
  }
  async testChat(chatId,label='SUPERVISOR SCB'){return this.send(`${label} — prueba de conexión\nEstado: OK`,chatId)}
  async send(text,chatIdOverride=null){if(!this.token||!(chatIdOverride||this.chatId))throw new Error('TELEGRAM_NOT_CONFIGURED');const target=String(chatIdOverride||this.chatId);const url=`https://api.telegram.org/bot${this.token}/sendMessage`,ids=[];for(const part of this.split(text)){const r=await this.fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:target,text:part,disable_web_page_preview:true})});const data=await r.json();if(!r.ok||!data.ok)throw new Error(`TELEGRAM_SEND_FAILED:${data.description||r.status}`);ids.push(data.result?.message_id||null)}return{ok:true,messageId:ids.at(-1)||null,messageIds:ids,parts:ids.length,chatId:target}}
}
module.exports={TelegramAdapter};
