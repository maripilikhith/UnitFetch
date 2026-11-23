const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve('UniFetch');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
const id=[...crypto.createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32)].map(c=>String.fromCharCode(97+parseInt(c,16))).join('');
(async()=>{
  fs.mkdirSync('test-results',{recursive:true});
  const fixture=fs.readFileSync('test-results/fixture.mp4');
  const server=http.createServer((req,res)=>{
    if(req.url==='/missing.mp4'){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':fixture.length});
    if(req.url==='/slow.mp4'){let offset=0;const timer=setInterval(()=>{res.write(fixture.subarray(offset,offset+1024));offset+=1024;if(offset>=fixture.length){clearInterval(timer);res.end();}},100);res.on('close',()=>clearInterval(timer));}
    else res.end(fixture);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  console.log('Starting isolated Chromium…');
  const context=await chromium.launchPersistentContext(path.resolve(`.tools/profiles/smoke-${Date.now()}`),{executablePath:process.env.TEST_BROWSER || chromium.executablePath(),headless:true,timeout:30000,ignoreDefaultArgs:['--disable-extensions'],acceptDownloads:true,downloadsPath:path.resolve('test-results/downloads'),viewport:{width:420,height:700},args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
  try {
    console.log('Browser launched; opening the extension page…');
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    console.log('Test page created.');
    await page.goto(`chrome-extension://${id}/popup/popup.html`,{timeout:15000});
    console.log('Extension page loaded.');
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker',{timeout:15000});
    try {await page.locator('#connection.ready').waitFor({timeout:90000});}
    catch(error){console.log('Connection details:',await page.locator('#helper-detail').textContent());await page.screenshot({path:'test-results/connection-error.png',fullPage:true});throw error;}
    console.log('PASS: extension loaded and native helper connected');
    await page.screenshot({path:'test-results/popup.png',fullPage:true});
    await page.locator('#settings-button').click();await page.locator('#save-as-setting').uncheck();await page.locator('#quality-setting').selectOption('720');
    await page.locator('[data-view="fetch"]').click();
    await page.locator('#video-url').fill(`http://127.0.0.1:${server.address().port}/fixture.mp4`);await page.locator('#inspect').click();
    await page.locator('#download-video').waitFor();assert.match(await page.locator('#video-result').innerText(),/MP4/);
    await page.locator('#download-video').click();
    await page.waitForFunction(async()=>{const {history=[]}=await chrome.storage.local.get('history');return history.some(j=>j.status==='complete' && j.provider==='direct')},{},{timeout:30000});
    console.log('PASS: real direct MP4 download completed through Chrome');
    await page.locator('[data-view="history"]').click();await page.screenshot({path:'test-results/history.png',fullPage:true});
    await page.reload();await page.locator('#settings-button').click();assert.equal(await page.locator('#quality-setting').inputValue(),'720');
    await page.locator('[data-view="fetch"]').click();await page.locator('#video-url').fill(`http://127.0.0.1:${server.address().port}/missing.mp4`);await page.locator('#inspect').click();await page.locator('#download-video').click();
    await page.waitForFunction(async()=>{const {history=[]}=await chrome.storage.local.get('history');return history.some(j=>j.status==='failed')},{},{timeout:30000});
    console.log('PASS: failed download is reported; settings and history survive popup reload');
    await page.locator('#video-url').fill(`http://127.0.0.1:${server.address().port}/slow.mp4`);await page.locator('#inspect').click();await page.locator('#download-video').click();
    const duplicate=await page.evaluate(async()=>{const {candidate}=await chrome.storage.session.get('candidate');return chrome.runtime.sendMessage({type:'DOWNLOAD',token:candidate.token,formatId:'direct'});});assert.equal(duplicate.ok,false);assert.match(duplicate.error,/already downloading/);
    await page.locator('#active-downloads').getByRole('button',{name:'Cancel',exact:true}).click();
    await page.waitForFunction(async()=>{const {history=[]}=await chrome.storage.local.get('history');return history.some(j=>j.status==='cancelled')},{},{timeout:15000});
    console.log('PASS: duplicate active downloads rejected; cancellation recorded');
    await page.locator('#video-url').fill('https://example.com/stream.m3u8');await page.locator('#inspect').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('HLS'));
    await page.locator('#clear-url').click();await page.locator('#video-url').fill('https://youtu.be/short');await page.locator('#inspect').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('one YouTube video'));
    const rejected=await page.evaluate(async()=>{const {handleMessage}=await import(chrome.runtime.getURL('background/message-handler.js'));try{await handleMessage({type:'CONNECT'},{id:chrome.runtime.id,url:'https://attacker.example/'});return false;}catch{return true;}});assert(rejected);
    assert.deepEqual(errors,[]);console.log('PASS: invalid links, unsupported streams, and untrusted message senders rejected; no page errors');
    await page.locator('[data-view="history"]').click();await page.locator('#clear-history').click();await page.waitForFunction(()=>document.querySelector('#history-count').textContent==='0');
    console.log('PASS: clear history');
  } catch(error) {console.error('Browser test error:',error);throw error;}
  finally {await Promise.race([context.close(),new Promise(resolve=>setTimeout(resolve,5000))]);server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
