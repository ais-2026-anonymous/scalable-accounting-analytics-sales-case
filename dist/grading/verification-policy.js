export function requireRecordedChecksum(input){
 const checksum=String(input??'').trim().toLowerCase();
 if(!checksum)throw Error('Enter the checksum you recorded when issuing this workbook. Grading is blocked until it is supplied.');
 if(!/^[a-f0-9]{64}$/.test(checksum))throw Error('Enter all 64 hexadecimal characters of the instructor’s recorded checksum.');
 return checksum;
}
