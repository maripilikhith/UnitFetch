import {build} from 'esbuild';
import {mkdir,readFile,writeFile,cp,readdir} from 'node:fs/promises';
const out='UniFetch/vendor';
await mkdir(`${out}/licenses`,{recursive:true});
await build({entryPoints:['scripts/vendor-entry.mjs'],outfile:`${out}/engine.js`,bundle:true,platform:'browser',format:'esm',target:'chrome120',minify:true,keepNames:true,define:{global:'globalThis'},legalComments:'eof'});
const notices=[];
for(const name of ['youtubei.js','googlevideo','mediabunny','@bufbuild/protobuf','fflate','meriyah']) {
  const dir=`node_modules/${name}`;
  const pkg=JSON.parse(await readFile(`${dir}/package.json`,'utf8'));
  const license=(await readdir(dir)).find(n=>/^licen[cs]e/i.test(n));
  if(!license&&name!=='@bufbuild/protobuf')throw new Error(`Missing license: ${name}`);
  await cp(license?`${dir}/${license}`:'scripts/licenses/protobuf.txt',`${out}/licenses/${name.replaceAll('/','-')}.txt`);
  notices.push(`${name} ${pkg.version} — ${pkg.license}\n${pkg.repository?.url||pkg.homepage||''}`);
}
await cp('node_modules/mediabunny/src',`${out}/sources/mediabunny/src`,{recursive:true});
await cp('node_modules/mediabunny/package.json',`${out}/sources/mediabunny/package.json`);
await cp('scripts/licenses/protobuf-bsd.txt',`${out}/licenses/protobuf-bsd.txt`);
await writeFile(`${out}/THIRD-PARTY.txt`,`${notices.join('\n\n')}\n\nMediabunny source is included unmodified under sources/mediabunny (MPL-2.0).\nRebuild from the repository with npm ci and npm run build:vendor.\n`);
console.log('Bundled browser engine, licenses, and MPL source.');
