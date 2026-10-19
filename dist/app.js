import {gradePython,clearPython} from './python-client.js?v=0.5.0';
import {ITEMS,RUBRIC,TAXONOMY,feedbackEvidence} from './grader.js?v=0.5.0';
import {tutorRequest,parseTutorFeedback} from './coach.js?v=0.5.0';
import {generateFeedback,cancelFeedback,feedbackError} from './remote-feedback.js?v=0.5.0';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let workbook=null,result=null,generating=false,session=0;
let selectedName='';
const STATUS={correct:'Matches',incorrect:'Review',missing:'Blank',unavailable:'Recalculate'};
function view(name){
 if(!['workspace','rubric','mistakes'].includes(name))name='workspace';
 document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!==`view-${name}`);
 document.querySelectorAll('[data-view]').forEach(e=>{e.classList.toggle('active',e.dataset.view===name);e.setAttribute('aria-current',e.dataset.view===name?'page':'false');});
 $('current-view').textContent={workspace:'Workbook review',rubric:'Grading rubric',mistakes:'Mistake library'}[name];
 history.replaceState(null,'',`#${name}`);window.scrollTo(0,0);
}
document.querySelectorAll('[data-view],[data-go]').forEach(e=>e.addEventListener('click',()=>view(e.dataset.view??e.dataset.go)));
view(location.hash.slice(1));
$('rubric-list').innerHTML=RUBRIC.map((r,i)=>`<section class="panel rubric-card"><div><span class="rubric-points">0${i+1} / ${r.points} PRACTICE POINTS</span><h3>${esc(r.title)}</h3><p>${esc(r.method)}</p><span class="cell-tag">${ITEMS.filter(x=>x.group===r.id).map(x=>x.cell).join(' · ')}</span></div><div class="rubric-levels">${r.levels.map(l=>`<div>${esc(l)}</div>`).join('')}</div></section>`).join('');
function library(){const q=$('mistake-search').value.toLowerCase();const list=TAXONOMY.filter(t=>`${t.title} ${t.description} ${t.hint} ${t.category}`.toLowerCase().includes(q));$('mistake-list').innerHTML=list.map(t=>`<article class="mistake-card"><span class="tiny-label">${esc(t.category.toUpperCase())} / ${esc(t.id.replaceAll('_',' ').toUpperCase())}</span><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p><p class="hint">${esc(t.hint)}</p></article>`).join('')||'<p>No matching concepts. Try another keyword.</p>';}
$('mistake-search').addEventListener('input',library);library();
function fmt(v,kind){if(v===null||v===undefined||v==='')return 'Blank';if(typeof v==='string')return v;if(['return','warranty'].includes(kind))return `${(v*100).toLocaleString('en-US',{maximumFractionDigits:4})}%`;return v.toLocaleString('en-US',{maximumFractionDigits:3});}
function render(){
 if(!result)return;
 if(!result.valid){$('results').className='';$('results').innerHTML=`<div class="score-summary"><div class="score-number">0<small> / 10</small></div><div class="score-caption"><b>Submission rejected</b>Python validation failed</div></div><p class="error-message">${esc(result.reason)}</p><p>Restore the required workbook format and answer boxes, then submit the saved file again.</p>`;$('focus-select').disabled=true;$('ask-coach').disabled=true;return;}
 const misses=result.results.filter(r=>r.status!=='correct').length;
 $('results').className='';
 $('results').innerHTML=`<div class="score-summary"><div><div class="score-number">${result.earned}<small> / 10</small></div><p>Technical practice score${result.unavailable?' · incomplete':''}</p></div><div class="score-caption"><b>${misses?`${misses} answer${misses===1?'':'s'} to revisit`:'All technical outputs match'}</b>${result.dailyCount.toLocaleString()} daily records · ${result.months} months<br>${esc(result.mode==='legacy'?'Original script compatibility':'Normalized concept checks')}</div></div>${result.unavailable?`<p class="warning">${result.unavailable} formula result${result.unavailable===1?' is':'s are'} unavailable. The score is provisional; those cells have not been assessed. Recalculate and save in Excel.</p>`:''}${result.integrity.demonstration?'<p class="info-banner">Practice demonstration: this synthetic sample is not a validated submission.</p>':`<details class="upload-help"><summary>Python submission checks passed</summary><p>Genuine supported Excel container; required sheets, identity fields, question positions, protected original copies, and a plausible frozen, locked timestamp are present.</p><p>Source-data fingerprint:<br><code>${esc(result.datasetFingerprint)}</code></p><p>The supplied macro does not record a seed. These checks do not authenticate generation time or detect copies across students without trusted cohort records.</p></details>`}${result.warnings.map(w=>`<p class="warning">${esc(w)}</p>`).join('')}${result.groups.map(g=>`<div class="group-row"><div class="group-head"><h3>${esc(g.title)}</h3><div><small>${g.earned} / ${g.points}</small><div class="mini-bar"><span style="width:${g.earned/g.points*100}%"></span></div></div></div>${result.results.filter(r=>r.group===g.id).map(r=>`<details class="answer-detail" ${r.status==='correct'?'':'open'}><summary><span class="status-mark ${r.status}">${r.status==='correct'?'✓':'!'}</span><span class="cell-tag">${r.cell}</span><span>${esc(r.product)}${r.period?` · ${esc(r.period)}`:''}</span><span class="${r.status==='correct'?'correct-label':'diagnosis'}">${STATUS[r.status]}</span></summary><div class="answer-content"><p><strong>Saved answer:</strong> ${esc(fmt(r.actual,r.kind))}</p>${r.status==='correct'?`<p>${esc(r.message)}</p>`:r.mistakes.map(m=>`<p><strong>${r.status==='incorrect'?'Possible pattern: ':''}${esc(m.title)}</strong><br>${esc(m.hint)}</p>`).join('')}${r.mistakes.length>1?'<p>Several methods could produce this number. Check your working before deciding which explanation applies.</p>':''}<button class="text-button focus-answer" data-cell="${r.cell}">Reflect on this answer ↗</button></div></details>`).join('')}</div>`).join('')}<div class="score-actions"><button class="text-button" id="download-feedback">Download feedback ↓</button><span class="small-note">No results stored</span></div>`;
 $('download-feedback').addEventListener('click',downloadFeedback);
 document.querySelectorAll('.focus-answer').forEach(b=>b.addEventListener('click',()=>{$('focus-select').value=b.dataset.cell;$('focus-select').dispatchEvent(new Event('change'));$('reflection').focus();$('coach-output').innerHTML='';}));
 $('focus-select').disabled=false;$('focus-select').innerHTML=result.results.map(r=>`<option value="${r.cell}">${r.cell} · ${esc(r.title)} · ${STATUS[r.status]}</option>`).join('');
 $('focus-select').value=result.results.find(r=>r.status!=='correct')?.cell??'B7';
 $('ask-coach').disabled=false;
 $('coach-output').innerHTML='';
}
function showFile(name){selectedName=name;$('file-info').hidden=false;$('dropzone').hidden=true;$('file-info').innerHTML=`<div class="file-summary"><span class="file-icon" aria-hidden="true">▤</span><div><strong>${esc(name)}</strong><p>Processed in browser memory · ${result?.source??'local data'}</p></div><button class="text-button" id="replace-file">Replace</button></div>`;$('replace-file').onclick=()=>$('file-input').click();$('file-status').textContent='Workbook checked';}
function message(text,error=false){$('upload-message').innerHTML=text?`<div class="${error?'error-message':'info-banner'}">${esc(text)}</div>`:'';}
async function readFile(file){
 if(!file)return;
 const id=++session;
 clearResult();
 if(!/\.(xlsx|xlsm)$/i.test(file.name)){result={valid:false,earned:0,reason:'Only .xlsx and .xlsm submissions are accepted. This file format receives zero.'};render();message(result.reason,true);return;}
 if(file.size>20*1024*1024){result={valid:false,earned:0,reason:'Submission exceeds the 20 MB limit.'};render();message(result.reason,true);return;}
 document.body.classList.add('busy');$('file-status').textContent='Reading workbook…';
 try{
  const bytes=await file.arrayBuffer();if(id!==session)return;
  $('file-status').textContent='Loading Python and validating…';
  const w={bytes,name:file.name},g=await gradePython(w,$('grading-policy').value);
  if(id!==session)return;workbook=w;result=g;render();showFile(file.name);message(g.valid?'Python has completed the validation and technical checks. Missing or misplaced answers earn zero for the designated cells.':g.reason,!g.valid);if(!g.valid)$('file-status').textContent='Rejected · 0/10';
 }catch(e){if(id===session){message(e.message||'The workbook could not be read. Check its format and try again.',true);$('file-status').textContent='Needs attention';}}
 finally{if(id===session)document.body.classList.remove('busy');}
}
$('file-input').onchange=e=>readFile(e.target.files[0]);
const dz=$('dropzone');dz.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file-input').click();}});
['dragenter','dragover'].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.add('dragover');}));
['dragleave','drop'].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.remove('dragover');}));dz.addEventListener('drop',e=>readFile(e.dataTransfer.files[0]));
$('sample-button').addEventListener('click',async()=>{
 const id=++session;clearResult();$('sample-button').disabled=true;message('Preparing a practice workbook…');
 try{const res=await fetch('assets/practice-case.json');if(!res.ok)throw new Error('The practice sample could not be loaded.');const data=await res.json();const w={sample:data};if(id!==session)return;result=await gradePython(w,$('grading-policy').value);if(id!==session)return;workbook=w;render();showFile('Practice sample · mixed answers');message('This practice sample uses case data with deliberately mixed answers. It is not a student submission.');}catch(e){if(id===session)message(e.message,true);}finally{$('sample-button').disabled=false;}
});
$('grading-policy').addEventListener('change',async()=>{
 ++session;resetFeedback();$('ask-coach').disabled=true;
 $('policy-note').textContent=$('grading-policy').value==='legacy'?'Reproduces the original CSV script’s one-decimal rounding. Percentage cell formatting can change this compatibility score.':'Accepts equivalent percentages and decimals. Technical answers receive one practice point each.';
 if(workbook){const id=session;try{const g=await gradePython(workbook,$('grading-policy').value);if(id!==session)return;result=g;render();}catch(e){if(id===session)message(e.message,true);}}
});
function clearResult(){
 workbook=null;result=null;selectedName='';$('file-info').hidden=true;$('dropzone').hidden=false;$('file-input').value='';$('focus-select').disabled=true;$('focus-select').innerHTML='<option>Check a workbook first</option>';$('ask-coach').disabled=true;$('reflection').value='';
 $('results').className='empty-results';$('results').innerHTML='<span class="empty-grid" aria-hidden="true">▤</span><p>Upload a workbook to see results.</p>';
 $('coach-output').innerHTML='';
 resetFeedback();
}
$('clear-session').addEventListener('click',async()=>{++session;clearResult();clearPython();message('Your workbook, score, explanation, and feedback have been cleared from this session.');$('file-status').textContent='Ready when you are';});
function downloadFeedback(){
 if(!result)return;
 const lines=['AUTOGRADER — PRACTICE FEEDBACK','Sales, returns & warranties',`Policy: ${result.mode}`,`Technical practice score: ${result.earned}/10${result.unavailable?' (provisional: saved formula results unavailable)':''}`,'No course grade is submitted.','',...result.warnings,''];
 lines.push('PYTHON VALIDATION',...Object.entries(result.integrity).map(([k,v])=>`${k}: ${v}`),`Source-data fingerprint: ${result.datasetFingerprint}`,'');
 for(const r of result.results){lines.push(`${r.cell} | ${r.title} | ${STATUS[r.status]}`,`Saved answer: ${fmt(r.actual,r.kind)}`,r.message,...r.mistakes.map(m=>`Possible pattern: ${m.title}. ${m.hint}`),'');}
 lines.push('Numerical pattern matches are hypotheses, not proof of the method used.','Only the ten designated technical answer cells are assessed.');
 const output=$('coach-output').querySelector('.feedback-box[data-generated="true"]');if(output)lines.push('','AI FEEDBACK (Hugging Face; formative suggestion)',output.textContent);
 const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='autograder-feedback.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function resetFeedback(){
 cancelFeedback();generating=false;$('ask-coach').textContent='Get feedback';$('ask-coach').disabled=!result?.valid;$('model-status').textContent='';$('coach-output').innerHTML='';
}
for(const [id,event] of [['reflection','input'],['focus-select','change']])$(id).addEventListener(event,()=>{++session;resetFeedback();});
$('ask-coach').addEventListener('click',async()=>{
 if(generating){++session;resetFeedback();return;}
 if(!result?.valid)return;
 const id=session,evidence=feedbackEvidence(result,$('focus-select').value,$('reflection').value);
 if(evidence.status==='unavailable'){$('coach-output').innerHTML='<p>Recalculate and save in Excel, then upload again.</p>';return;}
 generating=true;$('ask-coach').textContent='Cancel';$('coach-output').innerHTML='';
 try{
  let parsed,retryReason='';
  for(let attempt=0;attempt<2;attempt++){
   const raw=await generateFeedback(tutorRequest(evidence,retryReason),status=>{if(id===session)$('model-status').textContent=status;});
   if(id!==session)return;
   try{parsed=parseTutorFeedback(raw,evidence);break;}
   catch(e){if(attempt===1)throw e;retryReason=e.message;}
  }
  $('coach-output').innerHTML=`<p class="checker-anchor"><strong>Checked result</strong><br>${esc(evidence.answerCell)} · ${esc(STATUS[evidence.status])}</p><div class="feedback-box" data-generated="true" data-cell="${esc(evidence.answerCell)}"><p><strong>Explanation</strong>${esc(parsed.explanation)}</p><p><strong>Next step</strong>${esc(parsed.next_step)}</p><p><strong>Question</strong>${esc(parsed.question)}</p></div><p class="feedback-source">AI can make mistakes. Your score is unchanged.</p>`;
 }catch(e){if(id===session&&e.name!=='AbortError')$('coach-output').innerHTML=`<p>${esc(feedbackError(e))}</p>`;}
 finally{if(id===session){generating=false;$('model-status').textContent='';$('ask-coach').textContent='Get feedback';$('ask-coach').disabled=!result?.valid;}}
});
// Python grading is local. Optional selected findings and explanation go to Hugging Face.
