/* OOXML patcher: preserves the user's native VBA project and form button.
   The spreadsheet export API does not export macro workbooks or their controls. */
export const SCHEMA='acc3000-instructor-v1';
const M='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const P='http://schemas.openxmlformats.org/package/2006/relationships';
const A='http://schemas.openxmlformats.org/drawingml/2006/main';
const X='http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
export const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
export const COLORS=[{name:'Blue',hex:'DCEBFF'},{name:'Gold',hex:'FFF0BD'},{name:'Violet',hex:'E9DFFF'}];
const enc=new TextEncoder();
export const stable=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(stable).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
export async function sha(data){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof data==='string'?enc.encode(data):data))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function seeded(seed){let s=2166136261;for(const c of seed)s=Math.imul(s^c.charCodeAt(0),16777619);return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const integer=(r,a,b)=>a+Math.floor(r()*(b-a+1));
const shuffle=(a,r)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=integer(r,0,i);[a[i],a[j]]=[a[j],a[i]];}return a;};
export function makePlan(options,index=0){
 const r=seeded(options.seed+':'+index),labels=options.rename?{A:'Product '+String.fromCharCode(75+index%8)+integer(r,11,89),B:'Product '+String.fromCharCode(83+index%7)+integer(r,11,89)}:{A:'Product A',B:'Product B'};
 const id=options.assignment+'-V'+String(index+1).padStart(2,'0');
 const specs=[['revenue','aggregation'],['price','pricing'],['month','clearance'],['return','returns'],['warranty','warranties']];
 let questions=[];
 for(const [kind,group] of specs)for(const product of ['A','B']){
  const period=kind==='month'?null:options.periods?`${integer(r,2012,2019)}-${String(integer(r,1,12)).padStart(2,'0')}`:(product==='A'?'2012-02':'2019-12');
  const verb={revenue:'Monthly revenue (USD)',price:'Average selling price (USD per unit)',month:'Recurring clearance month (full English month name)',return:'Return rate for originating sales',warranty:'Warranty rate for originating sales'}[kind];
  const suffix=period?` for ${MONTHS[Number(period.slice(5))-1]} ${period.slice(0,4)}`:'';
  questions.push({id:group+'-'+product,kind,group,product,period,points:1,title:verb+' — '+labels[product],label:verb+' — '+labels[product]+suffix+'.'});
 }
 if(options.shuffle)questions=shuffle(questions,r);
 questions=questions.map((q,i)=>({...q,cell:'B'+(8+i*3),label:`${String(i+1).padStart(2,'0')}. ${q.label}`}));
 const imageCount=Number(options.imageCount??1);
 const checks=Array.from({length:imageCount},(_,i)=>{
  const row=39+i*15,target=integer(r,0,2);
  // Challenge answers are independent of the public, reproducible variant seed.
  const entropy=new Uint32Array(1);crypto.getRandomValues(entropy);
  return {id:'image-'+(i+1),row,boxes:COLORS.map((c,j)=>({name:c.name,cell:'B'+(row+7+j*2),labelCell:'A'+(row+7+j*2),label:`${c.name} box (${j+1})`,hex:c.hex})),target,answer:String(10000+entropy[0]%90000),style:options.imageStyle??'clear',accessible:!!options.accessible};
 });
 const factors=options.scale?{unitsA:integer(r,2,5),unitsB:integer(r,2,5),priceA:integer(r,1,3),priceB:integer(r,1,3)}:{unitsA:1,unitsB:1,priceA:1,priceB:1};
 return {schema:SCHEMA,id,course:options.course,seed:options.seed,labels,questions,checks,factors,issuedAt:new Date().toISOString(),assignedId:options.studentIds?.[index]??''};
}
const xml=s=>{const d=new DOMParser().parseFromString(s,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('Workbook contains invalid XML.');return d;};
const str=d=>new XMLSerializer().serializeToString(d);
const all=(n,tag,ns=M)=>[...n.getElementsByTagNameNS(ns,tag)];
const first=(n,tag,ns=M)=>all(n,tag,ns)[0];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function resolve(base,target){const p=target.startsWith('/')?target.slice(1):base.slice(0,base.lastIndexOf('/')+1)+target;const a=[];for(const x of p.split('/')){if(x==='..')a.pop();else if(x!=='.'&&x)a.push(x);}return a.join('/');}
function relPath(p){return p.slice(0,p.lastIndexOf('/')+1)+'_rels/'+p.slice(p.lastIndexOf('/')+1)+'.rels';}
async function text(z,p){const f=z.file(p);if(!f)throw Error('Required workbook part is missing: '+p);return f.async('string');}
export async function openBook(bytes,name='workbook.xlsm'){
 if(!/\.xlsm$/i.test(name))throw Error('Use a genuine .xlsm macro workbook for this instructor prototype.');
 if(bytes.byteLength>20*1024*1024)throw Error('Workbook exceeds 20 MB.');
 const z=await globalThis.JSZip.loadAsync(bytes);
 const entries=Object.values(z.files);if(entries.length>4000||entries.reduce((s,f)=>s+(f._data?.uncompressedSize??0),0)>100*1024*1024)throw Error('Workbook exceeds extraction limits.');
 if(entries.some(f=>f.name.includes('externalLinks/')||f.unsafeOriginalName?.split('/').includes('..')))throw Error('External links or unsafe archive paths are not accepted.');
 const types=await text(z,'[Content_Types].xml');
 if(!types.includes('application/vnd.ms-excel.sheet.macroEnabled.main+xml')||!z.file('xl/vbaProject.bin'))throw Error('The file is not a genuine macro-enabled Excel workbook.');
 const book=xml(await text(z,'xl/workbook.xml')),rels=xml(await text(z,'xl/_rels/workbook.xml.rels'));
 const targets=new Map(all(rels,'Relationship',P).map(r=>[r.getAttribute('Id'),resolve('xl/workbook.xml',r.getAttribute('Target'))]));
 const sheets=new Map(all(book,'sheet').map(s=>[s.getAttribute('name'),{node:s,path:targets.get(s.getAttributeNS(R,'id'))}]));
 const strings=z.file('xl/sharedStrings.xml')?all(xml(await text(z,'xl/sharedStrings.xml')),'si').map(si=>all(si,'t').map(t=>t.textContent).join('')):[];
 const docs=new Map();for(const [name,s] of sheets)docs.set(name,xml(await text(z,s.path)));
 const styles=xml(await text(z,'xl/styles.xml'));
 const date1904=first(book,'workbookPr')?.getAttribute('date1904');
 if(date1904==='1'||date1904==='true')throw Error('Use the supplied 1900-date-system case workbook.');
 return {z,book,rels,sheets,docs,strings,styles};
}
function cells(doc,strings){return new Map(all(doc,'c').map(c=>{
 const t=c.getAttribute('t'),v=first(c,'v')?.textContent;
 let value=t==='s'?strings[Number(v)]:t==='inlineStr'?all(c,'t').map(t=>t.textContent).join(''):t==='str'||t==='e'?v:v==null?null:Number(v);
 return[c.getAttribute('r'),{value,formula:first(c,'f')?.textContent,node:c,type:t}];
}));}
function dateKey(v,monthly=false){
 if(typeof v==='number')return new Date(Math.round((v-25569)*86400000)).toISOString().slice(0,monthly?7:10);
 if(/^\d{4}-\d{2}/.test(String(v)))return String(v).slice(0,monthly?7:10);
 const m=String(v).match(/^([A-Za-z]+) (\d{4})$/),i=m?MONTHS.indexOf(m[1]):-1;
 if(i<0)throw Error('Unrecognized source date.');return m[2]+'-'+String(i+1).padStart(2,'0');
}
function sourceRows(b,name,end,monthly=false){
 if(!b.docs.has(name))throw Error('Missing case source sheet: '+name);
 const c=cells(b.docs.get(name),b.strings),rows=[];
 for(let r=6;r<=end;r++){
  const row=[dateKey(c.get('A'+r)?.value,monthly)];
  for(const col of ['B','C','D','E']){
   const item=c.get(col+r),v=item?.value;
   if(item?.formula)throw Error('Source data still contain formulas. Run the supplied Generate Data button and save.');
   if(v!==null&&v!==undefined&&(typeof v!=='number'||!Number.isFinite(v)||v<0))throw Error('Invalid numeric source data.');
   row.push(v??null);
  }rows.push(row);
 }
 return rows;
}
export function scaleRows(sales,claims,f){
 return {sales:sales.map(r=>[r[0],r[1]*f.unitsA,r[2]*f.unitsA*f.priceA,r[3]*f.unitsB,r[4]*f.unitsB*f.priceB]),claims:claims.map(r=>[r[0],...r.slice(1).map((v,i)=>v==null?null:v*(i<2?f.unitsA:f.unitsB))])};
}
export function moveQuestion(plan,index,direction){
 const target=index+direction;if(target<0||target>=plan.questions.length)return;
 [plan.questions[index],plan.questions[target]]=[plan.questions[target],plan.questions[index]];
 plan.questions=plan.questions.map((q,i)=>({...q,cell:'B'+(8+i*3),label:String(i+1).padStart(2,'0')+'. '+q.label.replace(/^\d+\.\s*/, '')}));
}
const indexes=new WeakMap();
function put(doc,address,value,style){
 let ix=indexes.get(doc);if(!ix){const sd=first(doc,'sheetData');ix={sd,rows:new Map(all(sd,'row').map(r=>[r.getAttribute('r'),r])),cells:new Map(all(sd,'c').map(c=>[c.getAttribute('r'),c]))};indexes.set(doc,ix);}
 const rowId=address.match(/\d+/)[0];let row=ix.rows.get(rowId);
 if(!row){row=doc.createElementNS(M,'row');row.setAttribute('r',rowId);const next=[...ix.sd.children].find(r=>Number(r.getAttribute('r'))>Number(rowId));ix.sd.insertBefore(row,next??null);ix.rows.set(rowId,row);}
 let c=ix.cells.get(address);
 if(!c){c=doc.createElementNS(M,'c');c.setAttribute('r',address);const col=a=>[...a.match(/^[A-Z]+/)[0]].reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0);const next=[...row.children].find(n=>n.localName==='c'&&col(n.getAttribute('r'))>col(address));row.insertBefore(c,next??null);ix.cells.set(address,c);}
 while(c.firstChild)c.removeChild(c.firstChild);c.removeAttribute('t');if(style!=null)c.setAttribute('s',String(style));
 if(value==null)return c;
 if(typeof value==='number'){const v=doc.createElementNS(M,'v');v.textContent=String(value);c.appendChild(v);}
 else{c.setAttribute('t','inlineStr');const is=doc.createElementNS(M,'is'),t=doc.createElementNS(M,'t');t.textContent=String(value);is.appendChild(t);c.appendChild(is);}
 return c;
}
function addStyle(b,{numFmt=0,fill=null,bold=false,unlock=false,wrap=false,size=11}={}){
 const d=b.styles,fonts=first(d,'fonts'),fills=first(d,'fills'),xfs=first(d,'cellXfs');
 const fontId=fonts.children.length,font=d.createElementNS(M,'font');
 font.innerHTML=`${bold?'<b/>':''}<sz val="${size}"/><color rgb="FF20363B"/><name val="Arial"/>`;fonts.appendChild(font);fonts.setAttribute('count',fonts.children.length);
 let fillId=0;if(fill){fillId=fills.children.length;const f=d.createElementNS(M,'fill');f.innerHTML=`<patternFill patternType="solid"><fgColor rgb="FF${fill}"/><bgColor indexed="64"/></patternFill>`;fills.appendChild(f);fills.setAttribute('count',fills.children.length);}
 const id=xfs.children.length,xf=d.createElementNS(M,'xf');
 for(const [k,v]of Object.entries({numFmtId:numFmt,fontId,fillId,borderId:0,xfId:0,applyFont:1,applyFill:1,applyAlignment:1,applyProtection:1,applyNumberFormat:1}))xf.setAttribute(k,String(v));
 xf.innerHTML=`<alignment vertical="center"${wrap?' wrapText="1"':''}/><protection locked="${unlock?0:1}"/>`;xfs.appendChild(xf);xfs.setAttribute('count',xfs.children.length);return id;
}
function freshSheet(codeName='Sheet5'){
 return xml(`<worksheet xmlns="${M}" xmlns:r="${R}"><sheetPr codeName="${codeName}"/><dimension ref="A1:B80"/><sheetViews><sheetView showGridLines="0" zoomScale="100" workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="21"/><cols><col min="1" max="1" width="88" customWidth="1"/><col min="2" max="2" width="24" customWidth="1"/></cols><sheetData/></worksheet>`);
}
export function challengeImage(check){
 const c=document.createElement('canvas');c.width=1100;c.height=170;const x=c.getContext('2d');
 x.fillStyle='#F5F8FC';x.fillRect(0,0,c.width,c.height);x.strokeStyle='#CBD6DE';x.lineWidth=3;x.strokeRect(2,2,c.width-4,c.height-4);
 if(check.style==='light'){const r=seeded(check.answer);for(let i=0;i<16;i++){x.strokeStyle=i%2?'#DBE6E9':'#E1DFEA';x.lineWidth=1;x.beginPath();x.moveTo(r()*1100,r()*170);x.bezierCurveTo(r()*1100,r()*170,r()*1100,r()*170,r()*1100,r()*170);x.stroke();}}
 x.fillStyle='#233B44';x.font='bold 25px Arial';x.fillText('WORKBOOK INSTRUCTION',30,40);
 x.font='31px Arial';x.fillText(`Type ${check.answer} in the ${COLORS[check.target].name.toUpperCase()} box (${check.target+1}) below.`,30,92);
 x.font='24px Arial';x.fillText('Leave the other two boxes empty.',30,137);
 return c.toDataURL('image/png');
}
async function addPictures(b,solution,checks){
 const drawing=xml(`<xdr:wsDr xmlns:xdr="${X}" xmlns:a="${A}" xmlns:r="${R}"/>`);
 const dr=xml(`<Relationships xmlns="${P}"/>`),items=[];
 for(let i=0;i<checks.length;i++){
  const check=checks[i],url=challengeImage(check),bytes=Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0)),name=`acc3000_check_${i+1}.png`;
  b.z.file('xl/media/'+name,bytes);items.push({...check,imageSha:await sha(bytes),imageFile:name});
  const anchor=drawing.createElementNS(X,'xdr:oneCellAnchor');
  for(const [prefix,ns]of [['xdr',X],['a',A],['r',R]])anchor.setAttributeNS('http://www.w3.org/2000/xmlns/','xmlns:'+prefix,ns);
  anchor.innerHTML=`<xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${check.row-1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="7334250" cy="1133475"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i+1}" name="Visual instruction ${i+1}" descr="Read the instruction image and enter its value in the indicated box."/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${i+1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="7334250" cy="1133475"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/>`;
  drawing.documentElement.appendChild(anchor);
  const rel=dr.createElementNS(P,'Relationship');rel.setAttribute('Id','rId'+(i+1));rel.setAttribute('Type',R+'/image');rel.setAttribute('Target','../media/'+name);dr.documentElement.appendChild(rel);
 }
 b.z.file('xl/drawings/acc3000Checks.xml',str(drawing));b.z.file('xl/drawings/_rels/acc3000Checks.xml.rels',str(dr));
 const rels=xml(`<Relationships xmlns="${P}"><Relationship Id="rIdChecks" Type="${R}/drawing" Target="../drawings/acc3000Checks.xml"/></Relationships>`);
 b.z.file(relPath(b.sheets.get('Solution').path),str(rels));
 const d=solution.createElementNS(M,'drawing');d.setAttributeNS(R,'r:id','rIdChecks');solution.documentElement.appendChild(d);
 const ct=xml(await text(b.z,'[Content_Types].xml')),ns=ct.documentElement.namespaceURI;
 if(![...ct.documentElement.children].some(n=>n.getAttribute('Extension')==='png')){const e=ct.createElementNS(ns,'Default');e.setAttribute('Extension','png');e.setAttribute('ContentType','image/png');ct.documentElement.appendChild(e);}
 const override=ct.createElementNS(ns,'Override');override.setAttribute('PartName','/xl/drawings/acc3000Checks.xml');override.setAttribute('ContentType','application/vnd.openxmlformats-officedocument.drawing+xml');ct.documentElement.appendChild(override);b.z.file('[Content_Types].xml',str(ct));
 return items;
}
export async function createVariant(baseBytes,plan){
 const b=await openBook(baseBytes),baseVba=await sha(await b.z.file('xl/vbaProject.bin').async('uint8array'));
 for(const name of ['Title Page','Solution','Sales','Warranties & Returns','Reference'])if(!b.sheets.has(name))throw Error('Use the original ungenerated SalesSimulationSpring2026.xlsm base workbook.');
 // Always issue a fresh student copy: only the original cover is visible.
 for(const [name,sheet]of b.sheets)sheet.node.setAttribute('state',name==='Title Page'?'visible':'hidden');
 const coverIndex=[...b.sheets.keys()].indexOf('Title Page');
 for(const view of all(b.book,'workbookView')){view.setAttribute('activeTab',String(coverIndex));view.setAttribute('firstSheet','0');}
 for(const [name,doc]of b.docs)for(const view of all(doc,'sheetView'))view.setAttribute('tabSelected',name==='Title Page'?'1':'0');
 // Read cached base data, then explicitly freeze it. No uncertain browser formula evaluation.
 for(const name of ['Sales','Warranties & Returns'])for(const c of all(b.docs.get(name),'c'))first(c,'f')?.remove();
 const originalSales=sourceRows(b,'Sales',3658),originalClaims=sourceRows(b,'Warranties & Returns',125,true),data=scaleRows(originalSales,originalClaims,plan.factors);
 if(originalSales.some(r=>r.slice(1).some(v=>typeof v!=='number'||!Number.isFinite(v))||r[1]<=0||r[3]<=0)||originalClaims.some((r,i)=>r.slice(1).some((v,j)=>v==null&&i>=(j%2===0?1:2))))throw Error('The base workbook is missing saved simulation values. Recalculate and save the original base in desktop Excel before selecting it.');
 for(const [name,rows]of [['Sales',data.sales],['Warranties & Returns',data.claims]]){
  const d=b.docs.get(name);
  for(let i=0;i<rows.length;i++)for(let j=1;j<5;j++)put(d,'ABCDE'[j]+(i+6),rows[i][j]);
  put(d,'B4',plan.labels.A.replace(/^Product /,''));put(d,'D4',plan.labels.B.replace(/^Product /,''));
 }
 const reference=b.docs.get('Reference');for(const c of all(reference,'c'))first(c,'f')?.remove();put(reference,'C15',0);
 const solution=freshSheet(first(b.docs.get('Solution'),'sheetPr')?.getAttribute('codeName')??'Sheet5');
 const st={normal:addStyle(b),heading:addStyle(b,{bold:true,fill:'E3ECEF'}),label:addStyle(b,{wrap:true}),input:addStyle(b,{unlock:true,fill:'FFF3C9'}),number:addStyle(b,{numFmt:4,unlock:true,fill:'FFF3C9'}),rate:addStyle(b,{numFmt:10,unlock:true,fill:'FFF3C9'}),stamp:addStyle(b,{numFmt:22})};
 put(solution,'A1','Last Name',st.normal);put(solution,'A2','First Name',st.normal);put(solution,'A3','ID',st.normal);
 for(const a of ['B1','B2','B3'])put(solution,a,a==='B3'?plan.assignedId:null,st.input);
 // The original macro writes a timestamp only when both A4 and B4 are empty.
 put(solution,'A4',null,st.normal);put(solution,'B4',null,st.stamp);
 put(solution,'A5','Assignment checksum',st.normal);put(solution,'B5',null,addStyle(b,{size:8,wrap:true}));
 put(solution,'A6',plan.course+' — '+plan.id,st.heading);put(solution,'B6','Version '+plan.id,st.heading);
 for(const q of plan.questions){const row=Number(q.cell.slice(1));put(solution,'A'+row,q.label,st.label);put(solution,q.cell,null,q.kind==='month'?st.input:q.kind==='return'||q.kind==='warranty'?st.rate:st.number);}
 for(const check of plan.checks){
  put(solution,'A'+(check.row-1),'Visual instruction '+check.id.slice(-1),st.heading);
  for(const box of check.boxes){put(solution,box.labelCell,box.label,st.normal);put(solution,box.cell,null,addStyle(b,{unlock:true,fill:box.hex,bold:true}));}
  if(check.accessible)put(solution,'A'+(check.row+5),`Type ${check.answer} in the ${COLORS[check.target].name} box (${check.target+1}); leave the others empty.`,st.label);
 }
 const frozen=all(solution,'row');for(const row of frozen){const n=Number(row.getAttribute('r'));row.setAttribute('ht',plan.questions.some(q=>Number(q.cell.slice(1))===n)?'34':'24');row.setAttribute('customHeight','1');}
 const protection=solution.createElementNS(M,'sheetProtection');protection.setAttribute('sheet','1');solution.documentElement.appendChild(protection);
 const checks=await addPictures(b,solution,plan.checks);
 const immutable=[...cells(solution,[]).entries()].filter(([a])=>(a[0]==='A'&&a!=='A4')||a==='B6').map(([a,c])=>[a,c.value]).sort((a,b)=>a[0].localeCompare(b[0]));
 const meta={schema:SCHEMA,id:plan.id,course:plan.course,seed:plan.seed,labels:plan.labels,questions:plan.questions,factors:plan.factors,assignedId:plan.assignedId,checks:checks.map(({answer,target,imageFile,...rest})=>rest),immutable};
 const sourceDigest=await sha(stable(data));
 const checksum=await sha(stable({meta,sourceDigest,images:checks.map(c=>c.imageSha)}));
 put(solution,'B5',checksum);all(solution,'row').find(r=>r.getAttribute('r')==='5').setAttribute('ht','48');
 const receipt={...meta,checksum,sourceDigest,issuedAt:plan.issuedAt,baseVbaSha:baseVba,checks};
 // Custom XML is retained by Excel and does not become visible through UnhideAllSheets.
 b.z.file('customXml/acc3000.xml',`<?xml version="1.0"?><assignment xmlns="urn:acc3000:assignment" checksum="${checksum}">${esc(stable(meta))}</assignment>`);
 const rel=b.rels.createElementNS(P,'Relationship');rel.setAttribute('Id','rIdAcc3000');rel.setAttribute('Type',R+'/customXml');rel.setAttribute('Target','../customXml/acc3000.xml');b.rels.documentElement.appendChild(rel);
 const calc=all(b.rels,'Relationship',P).find(r=>r.getAttribute('Type').endsWith('/calcChain'));calc?.remove();b.z.remove('xl/calcChain.xml');
 const ct=xml(await text(b.z,'[Content_Types].xml'));for(const n of [...ct.documentElement.children])if(n.getAttribute('PartName')==='/xl/calcChain.xml')n.remove();b.z.file('[Content_Types].xml',str(ct));
 const calcPr=first(b.book,'calcPr');calcPr?.setAttribute('fullCalcOnLoad','1');
 // Avoid storing the original author's local path in issued copies.
 for(const n of [...b.book.getElementsByTagName('*')])if(n.localName==='absPath')n.parentNode.parentNode.remove();
 b.z.file('xl/_rels/workbook.xml.rels',str(b.rels));b.z.file('xl/workbook.xml',str(b.book));b.z.file('xl/styles.xml',str(b.styles));
 b.docs.set('Solution',solution);for(const [name,d]of b.docs)b.z.file(b.sheets.get(name).path,str(d));
 const title=b.docs.get('Title Page');put(title,'A1',plan.course+' — '+plan.id,st.heading);put(title,'A3','Click Generate Data once in desktop Excel. Complete the Solution sheet, including the image instruction after the questions, then save.',st.label);b.z.file(b.sheets.get('Title Page').path,str(title));
 const bytes=await b.z.generateAsync({type:'uint8array',compression:'DEFLATE'});
 return {bytes,receipt,filename:plan.id+'.xlsm',images:checks.map(challengeImage)};
}
async function embeddedMeta(b){
 const rel=all(b.rels,'Relationship',P).find(r=>r.getAttribute('Type')===R+'/customXml'&&r.getAttribute('Target').includes('acc3000'));
 let path=rel?resolve('xl/workbook.xml',rel.getAttribute('Target')):null;
 // Excel can rename the custom XML part when saving; locate it by its namespace.
 if(!path||!b.z.file(path))path=null;
 const candidates=path?[path]:Object.keys(b.z.files).filter(p=>/^customXml\/[^/]+\.xml$/.test(p));
 for(const p of candidates){const d=xml(await text(b.z,p));if(d.documentElement.namespaceURI==='urn:acc3000:assignment')return JSON.parse(d.documentElement.textContent);}
 throw Error('This workbook has no ACC3000 assignment definition. It may be a legacy or different assignment.');
}
async function pictureChecks(b){
 const solution=b.docs.get('Solution'),ref=first(solution,'drawing');if(!ref)throw Error('The image instruction drawing is missing.');
 const rels=xml(await text(b.z,relPath(b.sheets.get('Solution').path)));
 const r=all(rels,'Relationship',P).find(r=>r.getAttribute('Id')===ref.getAttributeNS(R,'id'));
 if(!r)throw Error('Image drawing relationship is missing.');
 const path=resolve(b.sheets.get('Solution').path,r.getAttribute('Target')),d=xml(await text(b.z,path)),dr=xml(await text(b.z,relPath(path)));
 const targets=new Map(all(dr,'Relationship',P).map(r=>[r.getAttribute('Id'),resolve(path,r.getAttribute('Target'))]));
 const checks=[];for(const pic of all(d,'pic',X)){
  const anchor=pic.parentNode,from=first(anchor,'from',X),blip=first(pic,'blip',A),prop=first(pic,'cNvPr',X);
  if(!from||!blip||prop?.getAttribute('hidden')==='1')throw Error('The instruction image is missing, hidden or relocated.');
  const target=targets.get(blip.getAttributeNS(R,'embed'));
  checks.push({row:Number(first(from,'row',X).textContent)+1,col:Number(first(from,'col',X).textContent),imageSha:await sha(await b.z.file(target).async('uint8array'))});
 }return checks.sort((a,b)=>a.row-b.row);
}
export async function verifySubmission(bytes,name,receipt){
 if(receipt?.schema!==SCHEMA||!/^[a-f0-9]{64}$/.test(receipt.checksum??''))throw Error('Load the original instructor receipt first.');
 const b=await openBook(bytes,name),meta=await embeddedMeta(b);
 if(meta.id!==receipt.id)throw Error('Assignment version mismatch: this submission belongs to '+meta.id+'.');
 if(b.sheets.has('Reference')||b.sheets.has('Title Page'))throw Error('Run Generate Data once in desktop Excel and save the resulting workbook before grading.');
 for(const n of ['Solution','Sales Locked','Warranties & Returns Locked'])if(!first(b.docs.get(n)??xml('<missing/>'),'sheetProtection'))throw Error('Required sheet protection is missing: '+n);
 const sol=cells(b.docs.get('Solution'),b.strings);
 if(sol.get('B5')?.value!==receipt.checksum)throw Error('The displayed assignment checksum does not match the instructor receipt.');
 if(meta.immutable.some(([a])=>sol.get(a)?.formula))throw Error('Assignment labels must remain fixed text.');
 for(const name of ['Sales Locked','Warranties & Returns Locked']){
  const source=cells(b.docs.get(name),b.strings);
  if(source.get('B4')?.value!==meta.labels.A.replace(/^Product /,'')||source.get('D4')?.value!==meta.labels.B.replace(/^Product /,''))throw Error('Checksum mismatch: protected product identifiers have changed.');
 }
 const position=a=>{const m=a.match(/^([A-Z]+)(\d+)$/);return [[...m[1]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0),Number(m[2])];};
 const answerCells=[...meta.questions.map(q=>q.cell),...meta.checks.flatMap(c=>c.boxes.map(b=>b.cell))];
 for(const merge of all(b.docs.get('Solution'),'mergeCell')){
  const [start,end]=merge.getAttribute('ref').split(':'),[c1,r1]=position(start),[c2,r2]=position(end??start);
  if(answerCells.some(a=>{const[c,r]=position(a);return c>=c1&&c<=c2&&r>=r1&&r<=r2;}))throw Error('An answer box has been merged or relocated.');
 }
 const styles=all(b.styles,'cellXfs')[0],fills=all(b.styles,'fills')[0];
 for(const check of meta.checks)for(const box of check.boxes){
  const si=Number(sol.get(box.cell)?.node.getAttribute('s')??0),xf=styles.children[si],fill=fills.children[Number(xf?.getAttribute('fillId')??0)];
  if(first(fill,'fgColor')?.getAttribute('rgb')!=='FF'+box.hex)throw Error('The colored answer-box layout has changed.');
 }
 const immutable=meta.immutable.map(([a])=>[a,sol.get(a)?.value??null]);
 if(stable(immutable)!==stable(meta.immutable))throw Error('Checksum mismatch: assignment labels or question positions have changed.');
 const data={sales:sourceRows(b,'Sales Locked',3658),claims:sourceRows(b,'Warranties & Returns Locked',125,true)};
 const sourceDigest=await sha(stable(data));
 const images=await pictureChecks(b);
 if(images.length!==meta.checks.length||images.some((v,i)=>v.row!==meta.checks[i].row||v.col!==0||v.imageSha!==meta.checks[i].imageSha))throw Error('Checksum mismatch: instruction images are missing, changed or relocated.');
 const checksum=await sha(stable({meta,sourceDigest,images:images.map(i=>i.imageSha)}));
 if(checksum!==receipt.checksum||sourceDigest!==receipt.sourceDigest)throw Error('Checksum mismatch: the assignment definition or protected source data differs from the issued version.');
 const visual=receipt.checks.map(check=>{
  const actual=check.boxes.map(box=>sol.get(box.cell)?.value??null),passed=String(actual[check.target]??'').trim()===check.answer&&actual.every((v,i)=>i===check.target||v===null||String(v).trim()==='');
  return {id:check.id,passed,expectedCell:check.boxes[check.target].cell,actual,message:passed?'Image instruction completed.':'The value must be in the indicated box and the other two boxes must be empty.'};
 });
 return {valid:true,checksum,meta,visual,identity:{last:sol.get('B1')?.value,first:sol.get('B2')?.value,id:sol.get('B3')?.value},questions:receipt.questions};
}
