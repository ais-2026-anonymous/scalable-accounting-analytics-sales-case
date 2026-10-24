import test from 'node:test';
import assert from 'node:assert/strict';
import {makePlan,scaleRows,stable,sha,moveQuestion,responseDigest,gradingDefinition} from '../dist/instructor/workbook-engine.js';
const options={assignment:'TEST',course:'ACC3000',seed:'case-2026',shuffle:true,rename:true,periods:true,scale:true,imageCount:2};
test('issued question maps cover all ten computations without duplicate answer cells',()=>{
 for(let i=0;i<12;i++){const p=makePlan(options,i);assert.equal(p.questions.length,10);assert.equal(new Set(p.questions.map(q=>q.id)).size,10);assert.equal(new Set(p.questions.map(q=>q.cell)).size,10);assert.ok(p.checks.every(c=>c.boxes.every(b=>Number(b.cell.slice(1))>35)));assert.ok(p.questions.every(q=>q.kind==='month'||/^201[2-9]-\d\d$/.test(q.period)));}
});
test('same seed replays question map and scaling; image answer is separate from public seed',()=>{
 const a=makePlan(options,0),b=makePlan(options,0),c=makePlan(options,1);assert.deepEqual(a.questions,b.questions);assert.deepEqual(a.factors,b.factors);assert.notDeepEqual(a.questions,c.questions);assert.ok(a.checks.every(x=>/^\d{5}$/.test(x.answer)));assert.notEqual(a.id,c.id);
});
test('three horizontal entry cells share one row and cannot overlap subsequent figures',()=>{
 for(let i=0;i<30;i++){
  const p=makePlan(options,i),all=p.checks.flatMap(c=>c.boxes.map(b=>b.cell));
  assert.equal(new Set(all).size,all.length);
  for(let j=0;j<p.checks.length;j++){
   const rows=p.checks[j].boxes.map(b=>Number(b.cell.slice(1)));
   assert.equal(rows[0],p.checks[j].row+3);
   assert.equal(new Set(rows).size,1);
   assert.deepEqual(p.checks[j].boxes.map(b=>b.cell.match(/^[A-Z]+/)[0]),['A','B','C']);
   if(j+1<p.checks.length)assert.ok(rows[2]<p.checks[j+1].row);
   assert.ok(rows[2]<=100);
  }
 }
});
test('scaling preserves lagged unit rates, missing observations and clearance price ratios',()=>{
 const originalSales=[['2012-01-01',10,100,20,400],['2012-02-01',10,50,20,200]],claims=[['2012-02',1,null,2,null]],f={unitsA:3,unitsB:2,priceA:2,priceB:3};
 const d=scaleRows(originalSales,claims,f);assert.equal(d.claims[0][1]/d.sales[0][1],.1);assert.equal(d.claims[0][3]/d.sales[0][3],.1);assert.equal(d.claims[0][2],null);assert.equal((d.sales[1][2]/d.sales[1][1])/(d.sales[0][2]/d.sales[0][1]),.5);assert.equal(d.sales[0][2],600);
});
test('canonical checksums ignore JSON key ordering but detect changed data',async()=>{
 assert.equal(await sha(stable({b:2,a:1})),await sha(stable({a:1,b:2})));assert.notEqual(await sha(stable({a:1})),await sha(stable({a:2})));
});
test('private image response commitment checks the token, its box and empty alternatives',async()=>{
 const correct=await responseDigest(['','12345','']);
 assert.equal(correct,await responseDigest([null,12345,'  ']));
 assert.notEqual(correct,await responseDigest(['12345','','']));
 assert.notEqual(correct,await responseDigest(['','12346','']));
 assert.notEqual(correct,await responseDigest(['1','12345','']));
});
test('private grading records restore old definitions and use the separately saved new definition',()=>{
 const plan=makePlan(options,0),{issuedAt,...definition}=plan;
 definition.checks=plan.checks.map(({answer,target,...rest})=>rest);
 const record={...plan,immutable:[],checksum:'a'.repeat(64)};
 const restored=gradingDefinition(record);
 assert.deepEqual(restored.questions,plan.questions);
 assert.ok(restored.checks.every(c=>!('answer' in c)&&!('target' in c)));
 assert.equal(gradingDefinition({...record,definition}),definition);
});
test('manual moves retain the computation identity while updating the displayed answer map',()=>{
 const p=makePlan(options,0),first=p.questions[0].id,second=p.questions[1].id;moveQuestion(p,0,1);assert.equal(p.questions[0].id,second);assert.equal(p.questions[1].id,first);assert.equal(p.questions[1].cell,'C11');assert.match(p.questions[1].label,/^02\. /);assert.equal(new Set(p.questions.map(q=>q.id)).size,10);
});
