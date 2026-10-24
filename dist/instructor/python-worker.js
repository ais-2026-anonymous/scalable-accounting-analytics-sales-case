let ready;
async function init(){
 importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js');
 const py=await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'});
 const [code,config,adapter]=await Promise.all(['../grader.py','../grader-config.json','instructor-grader.py'].map(async p=>{const r=await fetch(p);if(!r.ok)throw Error('Python grading file could not load.');return r.text();}));
 await py.runPythonAsync(code);py.globals.set('base_config_json',config);await py.runPythonAsync(adapter);return py;
}
let queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{
 let proxy,py;
 try{
  py=await(ready??=init());proxy=py.toPy(new Uint8Array(data.bytes));py.globals.set('submission_bytes',proxy);py.globals.set('submission_name',data.name);py.globals.set('receipt_json',JSON.stringify(data.receipt));
  const raw=await py.runPythonAsync('json.dumps(grade_instructor_submission(bytes(submission_bytes),submission_name,json.loads(receipt_json)))');self.postMessage({id:data.id,result:JSON.parse(raw)});
 }catch(e){self.postMessage({id:data.id,error:e.message??String(e)});}
 finally{proxy?.destroy();if(py)for(const k of ['submission_bytes','submission_name','receipt_json'])if(py.globals.has(k))py.globals.delete(k);}
 });};
