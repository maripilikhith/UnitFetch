const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve('UniFetch');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
const id=[...crypto.createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32)].map(c=>String.fromCharCode(97+parseInt(c,16))).join('');
const origin=`chrome-extension://${id}`;
const first='testClip001',second='testClip002';
const urlFor=videoId=>`https://www.youtube.com/watch?v=${videoId}`;

// These previews exist only in the test profile. No external video is fetched or downloaded.
function candidate(videoId) {
  return {token:`test-${videoId}`,sourceUrl:urlFor(videoId),expires:Date.now()+600000,video:{
    id:videoId,provider:'youtube',hostname:'youtube.com',title:`UI test fixture · ${videoId}`,
    author:'Local automated test',duration:125,engineToken:'test-only',
    formats:['mp4','webm'].flatMap(ext=>[2160,1440,1080,720,480,360,240,144].map(height=>({
      id:`${height}-${ext}`,ext,height,filesize:height*18000,label:`${height}p · ${ext.toUpperCase()} · video + audio`
    })))
  }};
}

(async()=>{
  fs.mkdirSync('test-results',{recursive:true});
  const context=await chromium.launchPersistentContext(path.resolve(`.tools/profiles/v2-${Date.now()}`),{
    executablePath:process.env.TEST_BROWSER || chromium.executablePath(),headless:true,timeout:30000,
    ignoreDefaultArgs:['--disable-extensions'],viewport:{width:1100,height:800},
    args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]
  });
  const errors=[];
  context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  try {
    await context.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:
      '<!doctype html><html><head><title>Local YouTube navigation fixture</title></head><body style="font:18px Segoe UI;padding:40px;background:#f5f8fc"><h1>Local UI test fixture</h1><p>This page simulates YouTube navigation. No video is fetched.</p></body></html>'
    }));
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    // Seeded UI previews have no real media cache; accept only that test token.
    await worker.evaluate(()=>{
      const send=chrome.runtime.sendMessage.bind(chrome.runtime);
      chrome.runtime.sendMessage=(message,...args)=>message?.target==='engine'&&message.action==='has_preview'&&message.payload?.token==='test-only'?Promise.resolve({ok:true,data:{valid:true}}):send(message,...args);
    });
    const control=await context.newPage();await control.goto(`${origin}/popup/popup.html?test=control`);
    await control.locator('#connection.ready').waitFor({timeout:90000});
    const youtube=await context.newPage();await youtube.goto(urlFor(first));await youtube.bringToFront();
    const launcher=youtube.locator('#unifetch-launcher');
    await launcher.getByRole('button',{name:'Open UniFetch side panel'}).waitFor();
    assert.equal(await launcher.count(),1);
    const position=await launcher.boundingBox();assert(position.x>1000 && position.y>700);
    await control.evaluate(value=>chrome.storage.session.set({candidate:value}),candidate(first));

    async function inactiveUI(query) {
      const created=context.waitForEvent('page');
      await worker.evaluate(url=>chrome.tabs.create({url,active:false}),`${origin}/popup/popup.html?${query}`);
      const page=await created;await page.waitForURL(`${origin}/popup/popup.html?${query}`);return page;
    }
    const popup=await inactiveUI('test=autocapture');
    await popup.locator('#download-video').waitFor();
    assert.equal(await popup.locator('#video-url').inputValue(),urlFor(first));
    assert.equal(await popup.locator('#current-context').isVisible(),true);
    assert.equal(await popup.locator('#download-video').getAttribute('data-format-id'),'1080-mp4');
    await popup.locator('label').filter({has:popup.locator('input[name="video-quality"][value="720-mp4"]')}).click();
    await popup.locator('label').filter({has:popup.locator('input[name="file-type"][value="webm"]')}).click();
    assert.equal(await popup.locator('#download-video').getAttribute('data-format-id'),'720-webm');
    console.log('PASS: opening the UI auto-captures and inspects the active YouTube video; quality survives file-type changes');
    await popup.setViewportSize({width:400,height:760});
    await popup.screenshot({path:'test-results/v2-fixture-light.png',fullPage:true,animations:'disabled'});

    // A trusted click reaches the real sidePanel API through the content-script message.
    await youtube.bringToFront();
    await launcher.getByRole('button',{name:'Open UniFetch side panel'}).click();
    await control.waitForFunction(async()=>{
      const contexts=await chrome.runtime.getContexts({contextTypes:['SIDE_PANEL']});
      return contexts.some(item=>item.documentUrl.includes('surface=panel'));
    },null,{timeout:15000});
    console.log('PASS: bottom-right page button opens the real Chrome side panel');
    await youtube.screenshot({path:'test-results/v2-launcher-fixture.png',fullPage:true});

    // Inspect the same production panel page in a background tab so Playwright can assert its DOM.
    const panel=await inactiveUI('surface=panel&test=responsive');
    await panel.locator('#download-video').waitFor();
    await panel.setViewportSize({width:320,height:760});
    assert.equal(await panel.locator('#open-panel').isVisible(),false);
    assert(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await popup.locator('#theme-toggle').click();
    await panel.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
    await panel.screenshot({path:'test-results/v2-fixture-panel-dark.png',fullPage:true,animations:'disabled'});
    console.log('PASS: 320px side-panel layout has no horizontal overflow; themes sync between surfaces');

    await control.evaluate(value=>chrome.storage.session.set({candidate:value}),candidate(second));
    // Another tab's inspection must not replace this popup's current video.
    assert.match(await popup.locator('#video-result').textContent(),new RegExp(first));
    await youtube.evaluate(url=>{history.pushState({},'',url);document.dispatchEvent(new Event('yt-navigate-finish'));},urlFor(second));
    await panel.waitForFunction(expected=>document.querySelector('#video-url').value===expected,urlFor(second));
    await panel.locator('#download-video').waitFor();
    assert.match(await panel.locator('#video-result').textContent(),new RegExp(second));
    assert.equal(await launcher.isVisible(),true);
    console.log('PASS: panel follows YouTube SPA navigation and ignores previews belonging to other links');

    await popup.locator('#open-panel').click();
    assert.equal(await popup.locator('#status.error').count(),0);
    await youtube.evaluate(async()=>document.documentElement.requestFullscreen());
    await launcher.waitFor({state:'hidden'});
    await youtube.evaluate(async()=>document.exitFullscreen());
    await launcher.waitFor({state:'visible'});
    console.log('PASS: popup panel shortcut works and page launcher hides during fullscreen');

    await panel.locator('#video-url').fill('https://example.com/my-video.mp4');
    await control.evaluate(value=>chrome.storage.session.set({candidate:value}),candidate(first));
    await youtube.evaluate(url=>{history.pushState({},'',url);document.dispatchEvent(new Event('yt-navigate-finish'));},urlFor(first));
    await youtube.waitForTimeout(250);
    assert.equal(await panel.locator('#video-url').inputValue(),'https://example.com/my-video.mp4');
    await panel.locator('#current-tab').click();await panel.locator('#video-url:not([disabled])').waitFor({timeout:60000});
    // Return to a non-video page; both the page launcher and automatic preview should disappear.
    await youtube.evaluate(()=>{history.pushState({},'','/');document.dispatchEvent(new Event('yt-navigate-finish'));});
    await launcher.waitFor({state:'hidden'});
    await panel.waitForFunction(()=>document.querySelector('#video-url').value==='');
    assert.equal(await panel.locator('#video-result').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log('PASS: pasted links stay put; launcher and followed preview clear off-video; no page errors');
  } catch(error) {
    console.error(error);
    for(const [index,page] of context.pages().entries())await page.screenshot({path:`test-results/v2-error-${index}.png`}).catch(()=>{});
    throw error;
  } finally {await context.close();}
})().catch(()=>{process.exitCode=1;});
