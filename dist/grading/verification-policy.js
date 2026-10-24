export function requireRecordedChecksum(input,receipt){
 const checksum=String(input??'').trim().toLowerCase();
 if(!checksum)throw Error('Enter the checksum you recorded when issuing this workbook. Grading is blocked until it is supplied.');
 if(!/^[a-f0-9]{64}$/.test(checksum))throw Error('Enter all 64 hexadecimal characters of the instructor’s recorded checksum.');
 if(!receipt?.versions?.some(v=>v.checksum===checksum))throw Error('The entered checksum is not in the loaded instructor receipt. Grading is blocked.');
 return checksum;
}
