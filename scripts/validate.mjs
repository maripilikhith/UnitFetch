import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve('UniFetch');
const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
const pkg=JSON.parse(await readFile(resolve('package.json'),'utf8'));
const helperVersion=(await readFile(resolve('helper/version.py'),'utf8')).match(/VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
assert.equal(manifest.version,pkg.version,'Extension and package versions must match');
assert.equal(manifest.version,helperVersion,'Extension and helper versions must match');
assert.equal(manifest.manifest_version,3);assert(manifest.key);
assert.deepEqual(manifest.permissions.sort(),['activeTab','downloads','nativeMessaging','storage'].sort());
for(const file of [manifest.action.default_popup,manifest.background.service_worker,...Object.values(manifest.icons)]) assert((await stat(join(root,file))).isFile(),file);
async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await scan(path);else if(entry.name.endsWith('.js'))execFileSync(process.execPath,['--check',path]);}}
await scan(root);
console.log('Manifest, permissions, referenced assets, and JavaScript syntax passed.');
