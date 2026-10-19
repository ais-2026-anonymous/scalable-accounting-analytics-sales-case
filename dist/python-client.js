let worker,serial=0;
const pending=new Map();
export function gradePython(input,mode='concept'){
 if(!worker){worker=new Worker(new URL('./python-worker.js?v=0.4.0',import.meta.url));worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);};worker.onerror=e=>{for(const p of pending.values())p.reject(Error(e.message||'The Python runtime could not load.'));pending.clear();worker.terminate();worker=null;};}
 const id=++serial;
 return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});worker.postMessage({id,mode,...input});});
}
export function clearPython(){if(worker)worker.terminate();worker=null;for(const p of pending.values())p.reject(Error('Session cleared.'));pending.clear();}
