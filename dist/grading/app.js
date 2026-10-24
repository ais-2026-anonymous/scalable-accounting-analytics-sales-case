import {verifySubmission} from '../instructor/workbook-engine.js?v=9';
import {requireRecordedChecksum} from './verification-policy.js?v=2';
import {getIssued} from '../instructor/issued-store.js';
const $=id=>document.getElementById(id),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let results=[],worker,job=0;const pending=new Map();
const say=(s,error=false)=>{$('status').textContent=s;$('status').classList.toggle('error',error);};
function download(bytes,name,type='application/octet-stream'){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function csv(rows){return rows.map(r=>r.map(v=>{v=String(v??'');if(/^[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}
function python(input){
 if(!worker){worker=new Worker(new URL('../instructor/python-worker.js',import.meta.url));worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);};worker.onerror=e=>{for(const p of pending.values())p.reject(Error(e.message||'Python could not start.'));pending.clear();worker.terminate();worker=null;};}
 return new Promise((resolve,reject)=>{const id=++job;pending.set(id,{resolve,reject});worker.postMessage({id,...input});});
}
$('grade-button').onclick=async()=>{
 results=[];$('grade-results').innerHTML='';$('export-results').disabled=true;
 let expected;try{expected=requireRecordedChecksum($('expected-checksum').value);}catch(e){say(e.message,true);return;}
 const files=[...$('submission-files').files];if(!files.length){say('Select one or more student workbooks.',true);return;}
 $('grade-button').disabled=true;
 try{
  const issued=await getIssued(expected);
  if(!issued){say('No private grading record for this checksum is saved in this browser. Use the browser that generated the workbooks, or restore the private archive on the generator page.',true);return;}
  for(let i=0;i<files.length;i++){
   const f=files[i];say(`Checking ${i+1} of ${files.length}: ${f.name}`);
   try{
    const bytes=await f.arrayBuffer(),integrity=await verifySubmission(bytes,f.name,issued);
    say('Integrity matched. Loading the Python numerical grader…');
    const technical=await python({bytes,name:f.name,receipt:issued});
    if(!technical.valid)throw Error(technical.reason);
    results.push({file:f.name,version:integrity.meta.id,integrity,technical,valid:true});
   }catch(e){results.push({file:f.name,valid:false,reason:e.message});}
   renderResults();
  }
  say('Checking complete.');$('export-results').disabled=!results.length;
 }catch(e){say(e.message,true);
 }finally{$('grade-button').disabled=false;}
};
const imageUnavailable=r=>r.integrity.visual.some(v=>v.passed===null);
const imageSummary=r=>imageUnavailable(r)?'Image checks: regenerate older workbook':`Image instructions: ${r.integrity.visual.filter(v=>v.passed).length}/${r.integrity.visual.length}`;
function renderResults(){
 $('grade-results').innerHTML=results.map(r=>r.valid?`<article class="panel result-card passed"><h3>${escape(r.file)}</h3><p>${escape(r.integrity.identity.first)} ${escape(r.integrity.identity.last)} · ${escape(r.integrity.identity.id)} · ${escape(r.version)}</p><div class="result-summary"><span class="pill">Instructor checksum verified</span><span class="pill">Technical answers: ${r.technical.earned}/10</span><span class="pill">${escape(imageSummary(r))}</span></div><details><summary>Answer checks</summary><table class="results"><thead><tr><th>Cell</th><th>Question</th><th>Result</th></tr></thead><tbody>${r.technical.results.map(q=>`<tr><td>${escape(q.cell)}</td><td>${escape(q.title)}</td><td>${escape(q.status)}</td></tr>`).join('')}${r.integrity.visual.map(v=>`<tr><td>${escape(v.expectedCell)}</td><td>Image instruction</td><td>${v.passed?'correct':escape(v.message)}</td></tr>`).join('')}</tbody></table></details></article>`:`<article class="panel result-card rejected"><h3>${escape(r.file)}</h3><p class="error-text">Version rejected — not graded</p><p>${escape(r.reason)}</p></article>`).join('');
}
$('export-results').onclick=()=>download(csv([['File','Version','Student ID','First name','Last name','Integrity','Technical score / 10','Image checks passed','Image checks total','Reason'],...results.map(r=>r.valid?[r.file,r.version,r.integrity.identity.id,r.integrity.identity.first,r.integrity.identity.last,'matched',r.technical.earned,imageUnavailable(r)?'unavailable':r.integrity.visual.filter(v=>v.passed).length,r.integrity.visual.length,imageUnavailable(r)?'Regenerate older workbook for image grading.':'']:[r.file,'','','','','rejected','','','',r.reason])]),'ACC3000_Grading_Results.csv','text/csv');
