const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(`.tools/upgrade-${Date.now()}/UniFetch`);
fs.mkdirSync(root,{recursive:true});
function installTag(tag) {
  const files=execFileSync('git',['ls-tree','-r','--name-only',tag,'--','UniFetch/'],{encoding:'utf8'}).trim().split('\n');
  for(const file of files) {
    const target=path.join(root,file.slice('UniFetch/'.length));
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,execFileSync('git',['show',`${tag}:${file}`],{maxBuffer:1024*1024}));
  }
}
installTag('v1.0.0');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
const id=[...crypto.createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32)].map(c=>String.fromCharCode(97+parseInt(c,16))).join('');
const origin=`chrome-extension://${id}`;
(async()=>{
  const context=await chromium.launchPersistentContext(path.join(root,'../profile'),{
    executablePath:process.env.TEST_BROWSER || chromium.executablePath(),headless:true,timeout:30000,
    ignoreDefaultArgs:['--disable-extensions'],viewport:{width:420,height:760},
    args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]
  });
  try {
    // Match a real unpacked installation. Command-line loading alone leaves this
    // off, and Chrome then disables the extension when runtime.reload() is used.
    const extensions=await context.newPage();await extensions.goto('chrome://extensions');
    const developerMode=extensions.getByRole('button',{name:'Developer mode',exact:true});
    if(await developerMode.getAttribute('aria-pressed')!=='true')await developerMode.click();
    assert.equal(await developerMode.getAttribute('aria-pressed'),'true');await extensions.close();
    const v1=await context.newPage();await v1.goto(`${origin}/popup/popup.html`);
    await v1.locator('#connection.ready').waitFor({timeout:90000});
    await v1.evaluate(()=>chrome.storage.local.set({settings:{quality:'720',saveAs:false}}));
    installTag('v2.0.0');
    const stale=await context.newPage();await stale.goto(`${origin}/popup/popup.html?test=stale-v2`);
    await stale.locator('#open-panel:not([disabled])').waitFor();
    assert.equal(await stale.evaluate(()=>chrome.runtime.getManifest().version),'1.0.0');
    await stale.locator('#theme-toggle').click();
    await stale.waitForFunction(async()=> (await chrome.storage.local.get('settings')).settings.quality==='1080');
    assert.equal(await stale.locator('html').getAttribute('data-theme'),'light');
    await stale.locator('#open-panel').click();
    await stale.waitForFunction(()=>document.querySelector('#status').textContent==='Unknown action.');
    console.log('REPRODUCED: v2 UI with the still-running v1 worker ignores dark mode and returns Unknown action for the panel');
    if(process.env.REPRO_ONLY==='1')return;

    fs.cpSync(path.resolve('UniFetch'),root,{recursive:true});
    const repaired=await context.newPage();await repaired.goto(`${origin}/popup/popup.html?test=repair`);
    await repaired.locator('#update-notice').waitFor();
    await repaired.evaluate(()=>chrome.storage.local.set({settings:{quality:'720',saveAs:false}}));
    await repaired.locator('#theme-toggle').click();
    await repaired.waitForFunction(async()=>document.documentElement.dataset.theme==='dark' && (await chrome.storage.local.get('settings')).settings.theme==='dark');
    const saved=await repaired.evaluate(async()=> (await chrome.storage.local.get('settings')).settings);
    assert.equal(saved.quality,'720');assert.equal(saved.saveAs,false);
    await repaired.reload();await repaired.locator('#update-notice').waitFor();
    assert.equal(await repaired.locator('html').getAttribute('data-theme'),'dark');
    await repaired.locator('#open-panel').click();
    await repaired.waitForFunction(()=>document.querySelector('#status').textContent.includes('Reload UniFetch'));
    console.log('PASS: dark mode works and persists with the old worker; missing panel permission explains the reload');

    await repaired.evaluate(()=>chrome.storage.local.set({history:[{id:'test-active',status:'downloading',provider:'youtube',title:'Test-only active job'}]}));
    await repaired.locator('#reload-extension:disabled').waitFor();
    await repaired.evaluate(()=>chrome.storage.local.set({history:[]}));
    await repaired.locator('#reload-extension:not([disabled])').waitFor();
    await repaired.locator('#reload-extension').click();
    console.log('Reload requested; reopening the extension to wake its updated worker…');
    const current=await context.newPage();
    // runtime.reload() unloads before asynchronously registering the new extension.
    for(let attempt=0;;attempt++) {
      try {await current.goto(`${origin}/popup/popup.html?test=updated`);break;}
      catch(error) {
        if(attempt===9)throw error;
        await new Promise(resolve=>setTimeout(resolve,250));
      }
    }
    await current.locator('#connection.ready').waitFor({timeout:90000});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker',{timeout:15000});
    assert.equal(await current.locator('#update-notice').isVisible(),false);
    assert.equal(await current.locator('html').getAttribute('data-theme'),'dark');
    await current.locator('#open-panel').click();
    await current.waitForFunction(async()=> (await chrome.runtime.getContexts({contextTypes:['SIDE_PANEL']})).length>0);
    console.log('PASS: one-click reload loads the new worker and side-panel permission, preserving settings');

    // Unlike a popup.html test tab, this creates Chrome's actual toolbar popup context.
    await worker.evaluate(async()=>chrome.sidePanel.close({windowId:(await chrome.windows.getCurrent()).id}));
    await worker.evaluate(()=>chrome.action.openPopup());
    assert(await worker.evaluate(async()=> (await chrome.runtime.getContexts({contextTypes:['POPUP']})).length>0));
    // Toolbar popups are not always announced as Playwright pages; attach to
    // the target matching the POPUP context rather than opening a test tab.
    const browserSession=await context.browser().newBrowserCDPSession();
    const {targetInfos}=await browserSession.send('Target.getTargets');
    const target=targetInfos.find(item=>item.url===`${origin}/popup/popup.html`);
    assert(target,'Expected a real toolbar popup target');
    const {sessionId}=await browserSession.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});
    let sequence=0;const pending=new Map();
    browserSession.on('Target.receivedMessageFromTarget',event=>{
      if(event.sessionId!==sessionId)return;
      const message=JSON.parse(event.message),task=pending.get(message.id);if(!task)return;
      pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);
    });
    async function send(method,params={}) {
      const id=++sequence;
      const reply=new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));
      await browserSession.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})});
      return reply;
    }
    async function evaluate(expression) {return (await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;}
    async function click(selector) {
      const box=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await send('Input.dispatchMouseEvent',{type:'mousePressed',...box,button:'left',clickCount:1});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',...box,button:'left',clickCount:1});
    }
    await evaluate('new Promise(resolve=>{const check=()=>document.querySelector("#open-panel")?.disabled===false?resolve(true):setTimeout(check,25);check();})');
    await click('#theme-toggle');
    assert.equal(await evaluate('document.documentElement.dataset.theme'),'light');
    await click('#open-panel');
    await current.waitForFunction(async()=> (await chrome.runtime.getContexts({contextTypes:['SIDE_PANEL']})).length>0);
    await current.waitForFunction(async()=> (await chrome.runtime.getContexts({contextTypes:['POPUP']})).length===0);
    console.log('PASS: theme and side-panel buttons work in a real Chrome toolbar popup');
  } finally {await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
