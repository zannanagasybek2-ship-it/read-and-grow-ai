import {createHmac,timingSafeEqual,createHash} from 'node:crypto';
const key=env=>env.SESSION_SECRET||createHash('sha256').update(env.SUPABASE_SERVICE_ROLE_KEY+'|reading-sessions').digest('hex');
const mac=(s,env)=>createHmac('sha256',key(env)).update(s).digest('base64url');
export function mintSession(payload,seconds,env){const data=Buffer.from(JSON.stringify({...payload,exp:Math.floor(Date.now()/1000)+seconds})).toString('base64url');return data+'.'+mac(data,env)}
export function readSession(cookie,name,env){try{const value=String(cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);if(!value)return null;const [data,sig]=value.split('.');const expected=mac(data,env);if(sig?.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;const p=JSON.parse(Buffer.from(data,'base64url').toString());return p.exp>Math.floor(Date.now()/1000)?p:null}catch{return null}}
export function sessionCookie(name,value,seconds){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`}
export function pinMatches(input,env){const a=String(input||''),b=String(env.SUPERVISOR_PIN||'');return /^\d{4}$/.test(a)&&/^\d{4}$/.test(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b))}
export function rateKey(ip,env){return createHmac('sha256',key(env)).update(String(ip)).digest('hex')}
