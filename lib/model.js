export const IDS = new Set(['prince','giant','happy','duckling','magi','leaf','matches','emperor','fisherman','mice','garden','tom','ghost','window','necklace','paw','carol','sherlock','alice','oz']);
export const MEDIA_TYPES = new Set(['video/mp4','video/webm','audio/webm','audio/mpeg','audio/wav','audio/x-wav']);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
const str=(x,n)=>String(x??'').trim().slice(0,n);
const q=(db,sql,...args)=>db.prepare(sql).bind(...args);
async function body(req,limit=500000){const text=await req.text();if(text.length>limit)fail('Request too large',413);try{return JSON.parse(text)}catch{fail('Invalid JSON')}}
export function cleanRecords(incoming,existing,valid){
 if(!plain(incoming))fail('Invalid progress');const out={...existing};
 for(const [id,r] of Object.entries(incoming)){if(!valid.has(id)||!plain(r))continue;const old=existing[id]||{};const next={read:!!(old.read||r.read),reflection:str(r.reflection,5000),visited:Array.isArray(r.visited)?[...new Set(r.visited.filter(n=>Number.isInteger(n)&&n>=0&&n<100))].slice(0,100):[],page:Math.min(99,Math.max(0,Number.isInteger(r.page)?r.page:0))};
 for(const [key,max]of [['vocab',20],['quiz',30],['order',20],['gap',10]])next[key]=Math.max(Number(old[key])||0,Math.min(max,Math.max(0,Math.floor(Number(r[key])||0))));
 next.vocabCorrect=Array.isArray(r.vocabCorrect)?[...new Set(r.vocabCorrect.filter(n=>Number.isInteger(n)&&n>=0&&n<20))]:[];
 for(const key of ['vocabStudiedAt','vocabReviewAt','vocabReviewStage'])if(typeof r[key]==='number'&&Number.isFinite(r[key]))next[key]=r[key];
 for(const key of ['media','teacherFeedback'])if(key in old)next[key]=old[key];out[id]=next;
 }return out;
}
export function validStory(s){return plain(s)&&/^custom-[a-z0-9-]{1,100}$/.test(s.id)&&['title','author','genre','level','prompt'].every(k=>typeof s[k]==='string'&&s[k].length<=2000)&&Array.isArray(s.pages)&&s.pages.length>0&&s.pages.length<=100&&s.pages.every(p=>typeof p==='string'&&p.length<10000)&&Array.isArray(s.words)&&s.words.length===20&&s.words.every(w=>Array.isArray(w)&&w.length===2&&/^[a-z]+(?: [a-z]+)*$/.test(w[0])&&typeof w[1]==='string')&&Array.isArray(s.quiz)&&s.quiz.length===3&&s.quiz.every(q=>Array.isArray(q)&&typeof q[0]==='string'&&Array.isArray(q[1])&&q[1].length===3&&q[1].every(a=>typeof a==='string')&&Number.isInteger(q[2])&&q[2]>=0&&q[2]<3&&typeof q[3]==='string')&&Array.isArray(s.order)&&s.order.length===4&&s.order.every(p=>typeof p==='string')&&Array.isArray(s.gap)&&s.gap.length===2&&s.gap.every(p=>typeof p==='string');}
