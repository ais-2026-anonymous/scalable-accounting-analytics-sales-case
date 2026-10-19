let ready;
async function init(){
 importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js');
 const py=await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'});
 const [code,config]=await Promise.all([fetch('grader.py?v=0.4.0').then(r=>{if(!r.ok)throw Error('Python grader source is unavailable.');return r.text();}),fetch('grader-config.json?v=0.4.0').then(r=>r.text())]);
 await py.runPythonAsync(code);py.globals.set('config_json',config);py.runPython('configure(json.loads(config_json))');py.globals.delete('config_json');return py;
}
async function handle(data){
 let proxy,py;
 try{
  py=await(ready??=init());py.globals.set('grading_mode',data.mode??'concept');
  let raw;
  if(data.bytes){proxy=py.toPy(new Uint8Array(data.bytes));py.globals.set('workbook_bytes',proxy);py.globals.set('workbook_name',data.name);raw=await py.runPythonAsync('json.dumps(grade_bytes(workbook_bytes, workbook_name, grading_mode))');}
  else{py.globals.set('sample_json',JSON.stringify(data.sample));raw=await py.runPythonAsync('json.dumps(grade_payload(json.loads(sample_json), grading_mode, False))');}
  self.postMessage({id:data.id,result:JSON.parse(raw)});
 }catch(e){self.postMessage({id:data.id,error:e.message??String(e)});}
 finally{proxy?.destroy();if(py)for(const k of ['workbook_bytes','workbook_name','sample_json','grading_mode'])if(py.globals.has(k))py.globals.delete(k);}
}
let queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(()=>handle(data));};
