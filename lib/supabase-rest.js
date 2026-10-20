// Small server-only PostgREST/Storage client. No browser secret or package install.
export function createClient(url,key,{fetch:fetcher=globalThis.fetch}={}){
 url=url.replace(/\/$/,'');
 const baseHeaders={apikey:key,Authorization:'Bearer '+key};
 async function request(path,options={}){try{const r=await fetcher(url+path,{...options,headers:{...baseHeaders,...options.headers}});const raw=await r.text();let data=null;try{data=raw?JSON.parse(raw):null}catch{data=raw}const count=Number(r.headers.get('content-range')?.split('/')[1]);if(!r.ok)return {data:null,error:{message:'Storage/database request failed',status:r.status},count:null};return {data,error:null,count:Number.isFinite(count)?count:null}}catch{return {data:null,error:{message:'Connection failed'},count:null}}}
 function from(table){let method='GET',payload,head=false,single=false;const params=new URLSearchParams();const prefer=[];const chain={
 select(columns='*',options={}){params.set('select',columns);head=!!options.head;if(options.count)prefer.push('count='+options.count);return chain},
 eq(field,value){params.set(field,'eq.'+value);return chain},lt(field,value){params.set(field,'lt.'+value);return chain},
 order(field,options={}){params.set('order',field+'.'+(options.ascending===false?'desc':'asc'));return chain},
 insert(value){method='POST';payload=value;return chain},
 upsert(value,options={}){method='POST';payload=value;prefer.push('resolution='+(options.ignoreDuplicates?'ignore-duplicates':'merge-duplicates'));if(options.onConflict)params.set('on_conflict',options.onConflict);return chain},
 delete(){method='DELETE';return chain},
 maybeSingle(){single=true;return execute()},single(){single=true;return execute()},
 then(resolve,reject){return execute().then(resolve,reject)}
 };async function execute(){const result=await request('/rest/v1/'+encodeURIComponent(table)+'?'+params,{method:head?'HEAD':method,headers:{...(payload?{'Content-Type':'application/json'}:{}),...(prefer.length?{Prefer:prefer.join(',')}:{})},...(payload?{body:JSON.stringify(payload)}:{})});if(single&&!result.error)result.data=Array.isArray(result.data)?result.data[0]||null:result.data;return result}return chain}
 const pathEncode=path=>path.split('/').map(encodeURIComponent).join('/');
 const fullUrl=path=>path?.startsWith('http')?path:url+'/storage/v1'+path;
 return {from,rpc:(name,args)=>request('/rest/v1/rpc/'+encodeURIComponent(name),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)}),storage:{from(bucket){const root='/storage/v1',b=encodeURIComponent(bucket);return {
 async createSignedUploadUrl(path){const r=await request(root+'/object/upload/sign/'+b+'/'+pathEncode(path),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.error)r.data={signedUrl:fullUrl(r.data.url||r.data.signedURL||r.data.signedUrl)};return r},
 async createSignedUrl(path,seconds){const r=await request(root+'/object/sign/'+b+'/'+pathEncode(path),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:seconds})});if(!r.error)r.data={signedUrl:fullUrl(r.data.signedURL||r.data.signedUrl)};return r},
 async info(path){const r=await request(root+'/object/info/'+b+'/'+pathEncode(path));if(!r.error)r.data={size:r.data.size??r.data.metadata?.size,contentType:r.data.contentType||r.data.content_type||r.data.metadata?.mimetype};return r},
 remove(paths){return request(root+'/object/'+b,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:paths})})}
 }}}};
}
