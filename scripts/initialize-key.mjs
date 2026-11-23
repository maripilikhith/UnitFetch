import {readFile,writeFile} from 'node:fs/promises';
import {generateKeyPairSync,createHash} from 'node:crypto';
const path=new URL('../UniFetch/manifest.json',import.meta.url);
const manifest=JSON.parse(await readFile(path,'utf8'));
if(!manifest.key){const {publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});manifest.key=publicKey.export({type:'spki',format:'der'}).toString('base64');await writeFile(path,JSON.stringify(manifest,null,2)+'\n');}
const id=[...createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32)].map(c=>String.fromCharCode(97+parseInt(c,16))).join('');
console.log(`UniFetch extension ID: ${id}`);
