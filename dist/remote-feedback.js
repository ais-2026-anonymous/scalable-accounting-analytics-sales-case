// Public, anonymous inference. No tokens, model weights or run history in the browser.
export const SPACE='hunterng/Accounting-Autograder-Feedback';
let connection,epoch=0,activeJob,abortActive;
const aborted=()=>new DOMException('Feedback cancelled.','AbortError');
export function cancelFeedback(){
 epoch++;
 if(activeJob)Promise.resolve(activeJob.cancel()).catch(()=>{});
 activeJob=null;abortActive?.();abortActive=null;
}
export function feedbackError(error){
 const message=error?.message??String(error);
 if(/quota|daily|GPU.*limit|exceeded.*limit/i.test(message))return 'Daily AI limit reached. Try again later.';
 if(/queue.*full/i.test(message))return 'The AI queue is full. Try again later.';
 return 'AI feedback is unavailable. Try again.';
}
export async function generateFeedback(request,onStatus=()=>{}){
 cancelFeedback();const id=epoch;
 const cancelled=new Promise((_,reject)=>{abortActive=()=>reject(aborted());});
 const work=(async()=>{
  onStatus('Connecting…');
  if(!connection)connection=import('./vendor/gradio.js?v=0.5.0').then(({Client})=>Client.connect(SPACE,{events:['data','status'],record_history:false})).catch(e=>{connection=null;throw e;});
  const client=await connection;if(id!==epoch)throw aborted();
  const job=client.submit('/feedback',[request]);activeJob=job;let output;
  for await(const event of job){
   if(id!==epoch)throw aborted();
   if(event.type==='status'){
    if(event.stage==='error')throw new Error(event.message||'Inference failed.');
    onStatus(event.stage==='generating'?'Writing feedback…':event.stage==='pending'?'Waiting for Hugging Face…':'');
   }
   if(event.type==='data')output=event.data?.[0];
  }
  if(typeof output!=='string')throw new Error('Incomplete feedback response.');
  return output;
 })();
 try{return await Promise.race([work,cancelled]);}
 finally{if(id===epoch){activeJob=null;abortActive=null;}}
}
