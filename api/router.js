import {createClient} from '../lib/supabase-rest.js';
import {handleApi} from '../lib/handler.js';
let cached;
export default async function handler(req,res){
 const env=process.env;
 const url=new URL(req.url,'https://local');
 const routed=req.query?.route||url.searchParams.get('route');
 const route=routed?'/api/'+(Array.isArray(routed)?routed.join('/'):String(routed)).replace(/^\/+/, ''):url.pathname;
 res.setHeader('Cache-Control','no-store');
 if(route==='/api/config'){return res.status(200).json({configured:!!(env.SUPABASE_URL&&env.SUPABASE_SERVICE_ROLE_KEY&&/^\d{4}$/.test(env.SUPERVISOR_PIN||''))})}
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||!/^\d{4}$/.test(env.SUPERVISOR_PIN||''))return res.status(503).json({error:'Platform setup is incomplete. Follow START_HERE_KZ.txt.'});
 cached??=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
 const origin=req.headers.origin,host=req.headers['x-forwarded-host']||req.headers.host;
 if(origin&&!['GET','HEAD'].includes(req.method)&&new URL(origin).host!==host)return res.status(403).json({error:'Origin denied'});
 try{
 const result=await handleApi({path:route,search:url.searchParams,method:req.method,cookie:req.headers.cookie||'',ip:String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim(),body:typeof req.body==='string'?JSON.parse(req.body):req.body||{}},cached,env);
 if(result.cookies)res.setHeader('Set-Cookie',result.cookies);
 return res.status(result.status||200).json(result.data);
 }catch(e){return res.status(e.status||500).json({error:e.status?e.message:'Could not complete the request. Please try again.'})}
}
