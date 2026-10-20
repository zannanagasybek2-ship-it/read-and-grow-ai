import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {handleApi} from '../lib/handler.js';
import {cleanRecords} from '../lib/model.js';
import {readSession,mintSession,pinMatches,sessionCookie} from '../lib/session.js';
import {createClient} from '../lib/supabase-rest.js';
const env={SUPABASE_SERVICE_ROLE_KEY:'test-only-secret-not-a-real-key',SUPERVISOR_PIN:'7391'};
assert.equal(pinMatches('7391',env),true);assert.equal(pinMatches('1234',env),false);assert.equal(pinMatches('73910',env),false);
const token=mintSession({role:'supervisor'},60,env);assert.equal(readSession('rg_supervisor='+token,'rg_supervisor',env).role,'supervisor');assert.equal(readSession('rg_supervisor='+token+'x','rg_supervisor',env),null);assert.equal(readSession('rg_supervisor='+mintSession({role:'supervisor'},-1,env),'rg_supervisor',env),null);assert.match(sessionCookie('s','t',1),/HttpOnly; Secure; SameSite=Lax/);
const tables={rg_config:[],rg_students:[],rg_library:[],rg_media:[],rg_pending:[]},limits=new Map(),objects=new Map();
const db={from(table){let action='select',payload,options={},count=false,filters=[];const chain={select(_,o={}){count=o.count;return chain},eq(k,v){filters.push(r=>r[k]===v);return chain},lt(k,v){filters.push(r=>r[k]<v);return chain},order(){return chain},insert(v){action='insert';payload=v;return chain},upsert(v,o={}){action='upsert';payload=v;options=o;return chain},delete(){action='delete';return chain},maybeSingle:async()=>{const r=await run();return {...r,data:r.data?.[0]||null}},single:async()=>{const r=await run();return {...r,data:r.data?.[0]||null}},then(resolve,reject){return run().then(resolve,reject)}};async function run(){if(action==='insert'||action==='upsert'){for(const input of Array.isArray(payload)?payload:[payload]){const keys=(options.onConflict||'id').split(',');const old=tables[table].find(r=>keys.every(k=>r[k]===input[k]));if(old&&action==='upsert'){if(!options.ignoreDuplicates)Object.assign(old,input)}else tables[table].push({id:randomUUID(),records:{},updated:new Date().toISOString(),...input,expires:new Date(Date.now()+900000).toISOString()})}}let rows=tables[table].filter(r=>filters.every(f=>f(r)));if(action==='delete')tables[table]=tables[table].filter(r=>!rows.includes(r));return {data:structuredClone(rows),error:null,count:count?rows.length:null}}return chain},async rpc(name,args){if(name==='rg_rate_limit'){const n=(limits.get(args.p_key)||0)+1;limits.set(args.p_key,n);return {data:n<=args.p_limit,error:null}}if(name==='rg_save_progress'){const s=tables.rg_students.find(s=>s.uid===args.p_uid);s.records=cleanRecords(args.p_incoming,s.records,new Set(Object.keys(args.p_incoming)));return {data:structuredClone(s.records),error:null}}if(name==='rg_patch_record'){const s=tables.rg_students.find(s=>s.id===args.p_id);if(!s)return {error:{message:'missing'}};s.records[args.p_story]={...s.records[args.p_story],[args.p_field]:args.p_value};return {data:true,error:null}}throw Error(name)},storage:{from(){return {async createSignedUrl(path){return {data:{signedUrl:'https://storage.example/'+path},error:null}},async createSignedUploadUrl(path){objects.set(path,{size:3,contentType:'video/mp4'});return {data:{signedUrl:'https://storage.example/upload/'+path},error:null}},async info(path){return {data:objects.get(path),error:objects.has(path)?null:{message:'missing'}}},async remove(paths){paths.forEach(p=>objects.delete(p));return {data:[],error:null}}}}}};
async function call(path,{method='GET',body={},cookie='',ip='127.0.0.1'}={}){const u=new URL(path,'https://read.example');try{return await handleApi({path:u.pathname,search:u.searchParams,method,body,cookie,ip},db,env)}catch(e){return {status:e.status||500,data:{error:e.message}}}}
assert.equal((await call('/api/teacher')).status,403);
assert.equal((await call('/api/supervisor-login',{method:'POST',body:{pin:'1234'}})).status,403);
let result=await call('/api/supervisor-login',{method:'POST',body:{pin:'7391'}});assert.equal(result.data.ok,true);const supervisor=result.cookies[0].split(';')[0];
result=await call('/api/teacher',{cookie:supervisor});const code=result.data.code;assert.match(code,/^[A-F0-9]{8}$/);
let join=await call('/api/join',{method:'POST',body:{code,name:'Reader One',className:'9 A'}});assert.equal(join.data.name,'Reader One');const reader=join.cookies[0].split(';')[0];
assert.equal((await call('/api/me',{cookie:reader})).data.student.name,'Reader One');
assert.equal((await call('/api/teacher',{cookie:reader})).status,403);
assert.equal((await call('/api/progress',{method:'POST',body:{records:{}}})).status,403);
result=await call('/api/progress',{method:'POST',cookie:reader,body:{name:'Reader One',records:{prince:{read:true,vocab:999,quiz:30,reflection:'A useful story.',teacherFeedback:'fake'}}}});assert.equal(result.data.records.prince.vocab,20);assert.equal(result.data.records.prince.teacherFeedback,undefined);
const sid=tables.rg_students[0].id;
await call('/api/feedback',{method:'POST',cookie:supervisor,body:{id:sid,story:'prince',text:'Well done'}});
result=await call('/api/progress',{method:'POST',cookie:reader,body:{records:{prince:{read:false,vocab:0}}}});assert.equal(result.data.records.prince.read,true);assert.equal(result.data.records.prince.vocab,20);assert.equal(result.data.records.prince.teacherFeedback,'Well done');
assert.equal((await call('/api/student/'+sid,{cookie:reader})).status,403);assert.equal((await call('/api/student/'+sid,{cookie:supervisor})).data.records.prince.teacherFeedback,'Well done');
const reservation=await call('/api/upload-url',{method:'POST',cookie:reader,body:{story:'prince',type:'video/mp4',size:3}});assert.ok(reservation.data.signedUrl);const upload=await call('/api/upload-complete',{method:'POST',cookie:reader,body:{id:reservation.data.id}});assert.equal(upload.data.type,'video/mp4');
assert.ok((await call('/api/media/'+upload.data.id,{cookie:supervisor})).data.url);
const other=await call('/api/join',{method:'POST',body:{code,name:'Other',className:'9 B'},ip:'other'});assert.equal((await call('/api/media/'+upload.data.id,{cookie:other.cookies[0].split(';')[0]})).status,403);
await call('/api/media?story=prince',{method:'DELETE',cookie:reader});assert.equal(objects.size,0);
assert.equal((await call('/api/library',{method:'POST',body:{stories:[]},cookie:reader})).status,403);
for(let i=0;i<6;i++)result=await call('/api/supervisor-login',{method:'POST',body:{pin:'0000'},ip:'attacker'});assert.equal(result.status,429);
const requests=[];const rest=createClient('https://project.supabase.co','secret',{fetch:async(url,o)=>{requests.push({url,o});return new Response('[{"id":"one"}]',{headers:{'content-range':'0-0/1'}})}});assert.equal((await rest.from('rg_students').select('*').eq('uid','x').maybeSingle()).data.id,'one');assert.match(requests[0].url,/uid=eq.x/);assert.equal(requests[0].o.headers.apikey,'secret');
const books=vm.runInNewContext(fs.readFileSync('web/data.js','utf8')+';stories');assert.equal(books.length,20);assert.ok(books.every(s=>s.pages.length===6&&s.pages.join(' ').split(/\s+/).length>500));
console.log('PASS: PIN, signed cookies, expired/tampered sessions, rate limiting, QR class join, persistent reader, supervisor permissions, best-score progress, feedback, private upload/playback, REST filters and 20 expanded books.');
// Verify Vercel's explicit rewrite parameter without requiring real credentials.
const {default:router}=await import('../api/router.js');
for(const route of [undefined,'config']){
 let status,data;const response={setHeader(){},status(n){status=n;return this},json(j){data=j;return this}};
 await router({url:route?'/api/router?route=config':'/api/config',query:route?{route}:{},method:'GET',headers:{}},response);
 assert.equal(status,200);assert.deepEqual(Object.keys(data),['configured']);
}
console.log('PASS: original and rewritten Vercel config routes expose configuration status only.');
