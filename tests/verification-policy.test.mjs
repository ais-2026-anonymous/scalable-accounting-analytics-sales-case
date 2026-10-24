import test from 'node:test';
import assert from 'node:assert/strict';
import {requireRecordedChecksum} from '../dist/grading/verification-policy.js';
const receipt={versions:[{id:'V01',checksum:'a'.repeat(64)}]};
test('grading cannot proceed without the instructor-entered checksum',()=>{
 for(const value of ['',null,undefined,'   '])assert.throws(()=>requireRecordedChecksum(value,receipt),/Enter the checksum/);
});
test('incomplete or non-hexadecimal checksums block grading',()=>{
 for(const value of ['a'.repeat(63),'a'.repeat(65),'z'.repeat(64)])assert.throws(()=>requireRecordedChecksum(value,receipt),/64 hexadecimal/);
});
test('a valid-looking checksum that was not issued under the receipt is rejected',()=>{
 assert.throws(()=>requireRecordedChecksum('b'.repeat(64),receipt),/not in the loaded instructor receipt/);
 assert.throws(()=>requireRecordedChecksum('a'.repeat(64),null),/not in the loaded instructor receipt/);
});
test('a full recorded checksum is accepted with case and surrounding whitespace normalized',()=>{
 assert.equal(requireRecordedChecksum('  '+'A'.repeat(64)+'  ',receipt),'a'.repeat(64));
});
