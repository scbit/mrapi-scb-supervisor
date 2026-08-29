const crypto=require('crypto');const {asDate}=require('./time');
function cursorWithLookback(cursor,m,now,h=24){const b=asDate(cursor);if(b)return new Date(b.getTime()-Math.max(0,+m||0)*60000);const n=asDate(now)||new Date();return new Date(n.getTime()-Math.max(1,+h||24)*3600000)}
function advanceCursor(prev,vals){let d=asDate(prev);for(const v of vals||[]){const x=asDate(v);if(x&&(!d||x>d))d=x}return d?d.toISOString():prev||null}
function stableFingerprint(v){function c(x){if(Array.isArray(x))return x.map(c);if(x&&typeof x==='object')return Object.keys(x).sort().reduce((a,k)=>(a[k]=c(x[k]),a),{});return x}return crypto.createHash('sha256').update(JSON.stringify(c(v))).digest('hex')}
module.exports={cursorWithLookback,advanceCursor,stableFingerprint};
