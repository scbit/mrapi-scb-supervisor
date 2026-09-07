const crypto=require('crypto');

function safeEqual(a,b){
  const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));
  return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y);
}
function parseCookies(raw=''){
  const out={};
  for(const part of String(raw||'').split(';')){
    const i=part.indexOf('=');
    if(i<0)continue;
    const k=part.slice(0,i).trim(),v=part.slice(i+1).trim();
    if(k)out[k]=decodeURIComponent(v);
  }
  return out;
}
function sessionValue(token){
  return crypto.createHmac('sha256',String(token)).update('supervisor-scb-browser-session-v1').digest('hex');
}
function requireCoreAuth(env=process.env){
  return(req,res,next)=>{
    const required=String(env.SUPERVISOR_REQUIRE_AUTH??'true').toLowerCase()!=='false';
    if(!required)return next();
    const token=String(env.SUPERVISOR_API_TOKEN||'').trim();
    if(!token)return res.status(503).json({ok:false,error:'CORE_AUTH_NOT_CONFIGURED'});

    const supplied=String(req.get('x-supervisor-token')||'');
    if(safeEqual(supplied,token)){
      const secure=String(req.get('x-forwarded-proto')||req.protocol||'').toLowerCase()==='https';
      const cookie=`supervisor_session=${encodeURIComponent(sessionValue(token))}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure?'; Secure':''}`;
      res.append('Set-Cookie',cookie);
      return next();
    }

    const cookies=parseCookies(req.get('cookie')||'');
    if(safeEqual(cookies.supervisor_session,sessionValue(token)))return next();
    return res.status(401).json({ok:false,error:'UNAUTHORIZED'});
  };
}
module.exports={safeEqual,parseCookies,sessionValue,requireCoreAuth};
