import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync} from 'fflate';
import assert from 'node:assert/strict';
const manifest=JSON.parse(await readFile('UniFetch/manifest.json','utf8'));
const files={};
async function collect(dir,relative='UniFetch') {
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    if(entry.name==='tests')continue;
    const path=join(dir,entry.name),key=`${relative}/${entry.name}`;
    if(entry.isDirectory())await collect(path,key);else files[key]=new Uint8Array(await readFile(path));
  }
}
await collect('UniFetch');
const zip=zipSync(files,{level:9});
const unpacked=unzipSync(zip);
assert(unpacked['UniFetch/manifest.json']);assert(unpacked['UniFetch/vendor/engine.js']);
assert(unpacked['UniFetch/vendor/sources/mediabunny/src/index.ts']);
assert(!Object.keys(unpacked).some(name=>/\/tests\/|native-client|\.exe$|\.py$|node_modules/.test(name)));
await mkdir('dist',{recursive:true});
const name=`UniFetch-v${manifest.version}-Chrome.zip`;
await writeFile(`dist/${name}`,zip);
await writeFile(`dist/${name}.sha256`,`${createHash('sha256').update(zip).digest('hex')}  ${name}\n`);
console.log(`Created dist/${name} (${(zip.length/1024/1024).toFixed(2)} MB), ${Object.keys(files).length} files; verified ZIP contents.`);
