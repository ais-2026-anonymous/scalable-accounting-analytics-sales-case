import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {feedbackEvidence} from '../dist/grader.js';
import {tutorContext,tutorRequest,parseTutorFeedback,checkerAnchor} from '../dist/coach.js';
const python="import importlib.util,json; from pathlib import Path; p=Path.cwd(); s=importlib.util.spec_from_file_location('grader',p/'dist/grader.py'); g=importlib.util.module_from_spec(s); s.loader.exec_module(g); g.configure(json.loads((p/'dist/grader-config.json').read_text())); print(json.dumps(g.grade_payload(json.loads((p/'dist/assets/practice-case.json').read_text()))))";
const result=JSON.parse(execFileSync(process.env.PYTHON??'python',['-c',python],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8'}));
const evidence=feedbackEvidence(result,'B19','I used February returns / February units.');
const output={checked_status:'incorrect',explanation:'Your February numerator concerns an earlier sales cohort. The requested February sales pair with March returns.',next_step:'Change the claim-month lookup to the month after the originating sales month.',question:'Which sales cohort generated returns booked in February?'};
test('grounded facts disambiguate same-month returns and year-crossing warranties',()=>{
 const returns=tutorContext(evidence),warranty=tutorContext(feedbackEvidence(result,'B25'));
 assert.match(returns.verifiedFacts.join(' '),/March 2012/);assert.match(returns.verifiedFacts.join(' '),/DENOMINATOR.*February 2012/);assert.doesNotMatch(returns.verifiedFacts.join(' '),/January/);
 assert.match(warranty.verifiedFacts.join(' '),/February 2020/);assert.match(warranty.verifiedFacts.join(' '),/December 2019/);
});
test('new prose is accepted and no question or pattern ID is required',()=>{assert.deepEqual(parseTutorFeedback(JSON.stringify(output),evidence),{explanation:output.explanation,next_step:output.next_step,question:output.question});});
test('changed checker verdict and blanket endorsement of incorrect work are rejected',()=>{
 assert.throws(()=>parseTutorFeedback(JSON.stringify({...output,checked_status:'correct'}),evidence),/status/);
 assert.throws(()=>parseTutorFeedback(JSON.stringify({...output,explanation:'Your answer is correct. Keep using February returns.'}),evidence),/incorrect/);
 assert.throws(()=>parseTutorFeedback(JSON.stringify({...output,explanation:'You are right about everything.'}),evidence),/incorrect/);
});
test('truncated, empty and oversized generations fail visibly instead of being rendered',()=>{
 assert.throws(()=>parseTutorFeedback('{"explanation":',evidence),/JSON/);
 assert.throws(()=>parseTutorFeedback(JSON.stringify({...output,question:''}),evidence),/complete/);
 assert.throws(()=>parseTutorFeedback(JSON.stringify({...output,next_step:'x'.repeat(1601)}),evidence),/concise/);
});
test('personalization uses only the selected check and bounded local reflection',()=>{
 const req=tutorRequest(evidence),body=JSON.parse(req.messages.at(-1).content);
 assert.equal(body.context.studentExplanation,evidence.studentExplanation);assert.equal(body.context.status,'incorrect');
 for(const k of ['expected','actual','filename','name','timestamp'])assert.equal(body.context[k],undefined);
 assert.equal(JSON.parse(req.response_format.schema).properties.checked_status.enum[0],'incorrect');
 assert.match(checkerAnchor(evidence),/B19.*needs review/);
});
test('invented out-of-range years and same-month cohort endorsement are rejected',()=>{
 assert.throws(()=>parseTutorFeedback(JSON.stringify({...output,explanation:'Your filter includes records from February 2012 and 2022.'}),evidence),/2011–2020/);
 assert.throws(()=>parseTutorFeedback(JSON.stringify({...output,explanation:'Your February bookings and February sales belong to the same sales cohort.',next_step:'Use March returns over February original units.'}),evidence),/same sales cohort/);
});
test('a stated missing-year filter must be addressed by generated feedback',()=>{
 const e={...evidence,studentExplanation:'I used MONTH(date)=2 and did not filter by year.'};
 assert.throws(()=>parseTutorFeedback(JSON.stringify(output),e),/year-filter/);
 const fixed={...output,explanation:'Your month-only filter pools different years. Also verify the March returns and February sales cohort.',next_step:'Filter by year and month, then check the claim-month lookup.'};
 assert.match(parseTutorFeedback(JSON.stringify(fixed),e).explanation,/years/);
});
