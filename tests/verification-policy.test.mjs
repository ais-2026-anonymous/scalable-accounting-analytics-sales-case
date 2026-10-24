import test from 'node:test';
import assert from 'node:assert/strict';
import {requireRecordedChecksum} from '../dist/grading/verification-policy.js';
test('grading cannot proceed without the instructor-entered checksum',()=>{
 for(const value of ['',null,undefined,'   '])assert.throws(()=>requireRecordedChecksum(value),/Enter the checksum/);
});
test('incomplete or non-hexadecimal checksums block grading',()=>{
 for(const value of ['a'.repeat(63),'a'.repeat(65),'z'.repeat(64)])assert.throws(()=>requireRecordedChecksum(value),/64 hexadecimal/);
});
test('checksum format validation needs no external receipt; the workbook verifier checks the digest',()=>{
 assert.equal(requireRecordedChecksum('b'.repeat(64)),'b'.repeat(64));
});
test('a full recorded checksum is accepted with case and surrounding whitespace normalized',()=>{
 assert.equal(requireRecordedChecksum('  '+'A'.repeat(64)+'  '),'a'.repeat(64));
});
