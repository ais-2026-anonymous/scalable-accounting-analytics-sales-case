import {WebWorkerMLCEngineHandler} from './vendor/webllm.js?v=0.4.0';
// Reconstruct exact trained tensors from a pinned public base and byte deltas.
const nativeFetch=self.fetch.bind(self);
const repositoryPrefix='/hunterng/CaseLab-Qwen3-4B-SFT-q4f16_1-MLC/resolve/';
let deltaManifest;
const baseCache=new Map();
const isShard=url=>url.origin==='https://huggingface.co'&&url.pathname.startsWith(repositoryPrefix)&&/\/params_\d+\.bin$/.test(url.pathname);
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
async function getBase(source,manifest){
 if(!baseCache.has(source.file)){
  const pending=(async()=>{
   const response=await nativeFetch(new URL(source.file,manifest.baseUrl),{cache:'force-cache'});
   if(!response.ok)throw Error('The public base model could not be downloaded.');
   const bytes=new Uint8Array(await response.arrayBuffer());
   if(await digest(bytes)!==source.sha256)throw Error('Public base model integrity check failed.');
   return bytes;
  })();
  baseCache.set(source.file,pending);
  while(baseCache.size>4)baseCache.delete(baseCache.keys().next().value);
 }
 return baseCache.get(source.file);
}
self.fetch=async(input,options)=>{
 const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,self.location.href);
 if(!isShard(url))return nativeFetch(input,options);
 const modelRoot=new URL('.',url);
 deltaManifest??=nativeFetch(new URL('weight-deltas.json',modelRoot)).then(r=>{if(!r.ok)throw Error('Trained weight manifest is unavailable.');return r.json();});
 const manifest=await deltaManifest,shard=manifest.shards[url.pathname.split('/').pop()];
 if(!shard)throw Error('Unknown trained tensor shard.');
 const baseline=new Uint8Array(shard.bytes);
 for(const source of shard.sources){
  const bytes=await getBase(source,manifest);
  baseline.set(bytes.subarray(source.offset,source.offset+source.bytes),source.target);
 }
 const buffers=await Promise.all(shard.parts.map(name=>nativeFetch(new URL(name,modelRoot),options).then(r=>{if(!r.ok)throw Error('Trained weight update is unavailable.');return r.arrayBuffer();})));
 const stream=new Blob(buffers).stream().pipeThrough(new DecompressionStream('gzip'));
 const delta=new Uint8Array(await new Response(stream).arrayBuffer());
 if(delta.length!==baseline.length)throw Error('Trained weight update size mismatch.');
 for(let i=0;i<baseline.length;i++)baseline[i]^=delta[i];
 if(await digest(baseline)!==shard.sha256)throw Error('Trained model integrity check failed.');
 return new Response(baseline,{status:200,headers:{'Content-Type':'application/octet-stream','Content-Length':String(baseline.byteLength)}});
};
const nativeAdd=Cache.prototype.add;
Cache.prototype.add=async function(request){
 const url=new URL(typeof request==='string'||request instanceof URL?String(request):request.url,self.location.href);
 if(isShard(url))return this.put(request,await self.fetch(request));
 return nativeAdd.call(this,request);
};
const handler=new WebWorkerMLCEngineHandler();
self.onmessage=message=>handler.onmessage(message);
