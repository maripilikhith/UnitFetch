const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve('UniFetch');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
const id=[...crypto.createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32)].map(c=>String.fromCharCode(97+parseInt(c,16))).join('');
(async()=>{
  const context=await chromium.launchPersistentContext(path.resolve(`.tools/profiles/youtube-${Date.now()}`),{executablePath:process.env.TEST_BROWSER || chromium.executablePath(),headless:true,ignoreDefaultArgs:['--disable-extensions'],viewport:{width:420,height:900},args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
  try{
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`chrome-extension://${id}/popup/popup.html`);await page.locator('#connection.ready').waitFor({timeout:45000});console.log('Native helper connected.');
    await page.locator('#video-url').fill('https://youtu.be/aqz-KE-bpKQ');await page.locator('#inspect').click();
    await page.waitForFunction(()=>document.querySelector('#download-video') || document.querySelector('#status.error'),{},{timeout:120000});
    console.log('Inspection status:',await page.locator('#status').textContent());
    await page.screenshot({path:'test-results/youtube-inspection.png',fullPage:true});
    assert.equal(await page.locator('#download-video').count(),1,'YouTube inspection should offer formats');
    assert.match(await page.locator('#video-result').innerText(),/Big Buck Bunny/);
    await page.locator('#format-select').selectOption('144-webm');
    await page.screenshot({path:'test-results/youtube-preview.png',fullPage:true});
    await page.setViewportSize({width:1000,height:920});await page.screenshot({path:'test-results/expanded-preview.png',fullPage:true});
    await page.setViewportSize({width:420,height:900});
    await page.locator('#download-video').click();
    await page.locator('#active-downloads').getByRole('button',{name:'Cancel',exact:true}).waitFor({timeout:10000});
    await page.locator('#active-downloads').getByRole('button',{name:'Cancel',exact:true}).click();
    await page.waitForFunction(async()=>{const {history=[]}=await chrome.storage.local.get('history');return history.some(j=>j.provider==='youtube' && j.status==='cancelled')},{},{timeout:30000});
    assert.deepEqual(errors,[]);
    await page.locator('[data-view="history"]').click();await page.locator('#clear-history').click();await page.waitForFunction(()=>document.querySelector('#history-count').textContent==='0');
    console.log('PASS: live YouTube UI inspection, actual native download start, cancellation, and native history clearing.');
  }catch(error){console.error(error);throw error;}finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
