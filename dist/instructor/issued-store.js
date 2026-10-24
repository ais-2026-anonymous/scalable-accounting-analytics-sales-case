const DB='acc3000-instructor-records',STORE='issued';
function open(){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'checksum'});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(Error('Private browser storage is unavailable. Enable site storage before generating or restoring grading records.'));
 });
}
export async function saveIssued(records){
 if(!Array.isArray(records)||!records.length||records.length>100||records.some(r=>r?.schema!=='acc3000-instructor-v1'||!/^[a-f0-9]{64}$/.test(r.checksum??'')||r.questions?.length!==10||!Array.isArray(r.checks)||!Array.isArray(r.immutable)))throw Error('This is not a supported instructor grading archive.');
 const db=await open();
 try{await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite');
  tx.oncomplete=resolve;tx.onerror=()=>reject(Error('Grading records could not be saved. Keep the private archive and retry.'));tx.onabort=()=>reject(Error('Saving grading records was interrupted.'));
  for(const record of records)tx.objectStore(STORE).put(record);
 });}finally{db.close();}
}
export async function getIssued(checksum){
 const db=await open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).get(checksum);
  request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>reject(Error('The saved grading record could not be read.'));
 });}finally{db.close();}
}
