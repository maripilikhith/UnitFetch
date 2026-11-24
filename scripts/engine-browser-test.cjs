const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
// Only the isolated test copy substitutes extraction/network input. The production
// offscreen document, messaging, muxer, history and Chrome download APIs run unchanged.
(async()=>{
 const root=path.resolve(`.tools/engine-fixture-${Date.now()}`);
 fs.cpSync('UniFetch',root,{recursive:true});
 fs.renameSync(path.join(root,'vendor/engine.js'),path.join(root,'vendor/real-engine.js'));
 fs.writeFileSync(path.join(root,'vendor/engine.js'),`
 export * from './real-engine.js';
 const realFetch=globalThis.fetch;
 let mode='normal';
 globalThis.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input.url||input.href;
   if(!url.startsWith('https://fixture.googlevideo.com/'))return realFetch(input,init);
   if(mode==='failed')return new Response('failed',{status:403});
   const bytes=new Uint8Array(await (await realFetch(chrome.runtime.getURL('tests/fixtures/av.'+(mode==='webm'?'webm':'mp4')))).arrayBuffer());
   let offset=0;
   return new Response(new ReadableStream({async pull(controller){
     if(mode==='slow')await new Promise(r=>setTimeout(r,150));
     if(init.signal?.aborted){controller.error(init.signal.reason);return;}
     if(offset>=bytes.length){controller.close();return;}
     controller.enqueue(bytes.slice(offset,offset+4096));offset+=4096;
   }}));
 };
 export const Innertube={async create(){return {session:{player:{},context:{client:{}}},async getBasicInfo(id){
   mode=({'testFail001':'failed','testSlow001':'slow','testWebm001':'webm','testShort01':'truncated'})[id]||'normal';
   const ext=mode==='webm'?'webm':'mp4';
   return {playability_status:{status:'OK'},basic_info:{title:'Original fixture '+id,duration:mode==='truncated'?60:3},streaming_data:{adaptive_formats:[
    {itag:1,mime_type:'video/'+ext,height:180,quality_label:'180p',content_length:110000,decipher:async()=>'https://fixture.googlevideo.com/video'},
    {itag:2,mime_type:'audio/'+ext,audio_quality:'AUDIO_QUALITY_MEDIUM',content_length:110000,decipher:async()=>'https://fixture.googlevideo.com/audio'}
   ]}};
 }}}};`);
 const context=await chromium.launchPersistentContext(path.resolve(`.tools/profiles/engine-fixture-${Date.now()}`),{executablePath:process.env.TEST_BROWSER||chromium.executablePath(),headless:true,ignoreDefaultArgs:['--disable-extensions'],acceptDownloads:true,downloadsPath:path.resolve('test-results/engine-downloads'),args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 try {
  let page=await context.newPage();const origin='chrome-extension://dglchdhjnkgalbimblbbpgbmofaicngj';
  await page.goto(origin+'/popup/popup.html');await page.locator('#connection.ready').waitFor();
  const worker=context.serviceWorkers()[0];
  assert(!(await worker.evaluate(()=>chrome.runtime.getManifest().permissions)).includes('nativeMessaging'));
  await page.evaluate(()=>chrome.storage.local.set({settings:{saveAs:false,quality:'best',theme:'light'}}));
  async function begin(id){
   const result=await page.evaluate(url=>chrome.runtime.sendMessage({type:'INSPECT',url}),`https://www.youtube.com/watch?v=${id}`);assert(result.ok,result.error);
   const start=await page.evaluate(v=>chrome.runtime.sendMessage({type:'DOWNLOAD',token:v.token,formatId:v.formats[0].id}),result.data);assert(start.ok,start.error);return start.data.id;
  }
  async function terminal(id){
   for(let i=0;i<150;i++){
    const job=await worker.evaluate(async id=>(await chrome.storage.local.get('history')).history.find(j=>j.id===id),id);
    if(['complete','failed','cancelled'].includes(job?.status))return job;
    await new Promise(r=>setTimeout(r,100));
   }throw new Error('Job timed out');
  }
  for(const id of ['testGood001','testWebm001']){
   const job=await terminal(await begin(id));assert.equal(job.status,'complete',job.error);assert(job.bytes>1000);
   const [item]=await worker.evaluate(id=>chrome.downloads.search({id}),job.downloadId);assert.equal(item.state,'complete');
   console.log('PASS: real offscreen '+(id==='testWebm001'?'WebM':'MP4')+' merging and Chrome file save');
   await page.waitForTimeout(200);
  }
  const failure=await terminal(await begin('testFail001'));assert.equal(failure.status,'failed');assert.equal(failure.downloadId,undefined);
  const partial=await terminal(await begin('testShort01'));assert.equal(partial.status,'failed');assert.match(partial.error,/partial/);assert.equal(partial.downloadId,undefined);
  console.log('PASS: network failures and truncated streams save no partial files');
  const slow=await begin('testSlow001');
  const cancel=await page.evaluate(id=>chrome.runtime.sendMessage({type:'CANCEL',id}),slow);assert(cancel.ok,cancel.error);assert.equal((await terminal(slow)).status,'cancelled');
  await page.waitForTimeout(300);assert.equal((await terminal(slow)).status,'cancelled');
  console.log('PASS: browser extraction cancellation remains cancelled');
  const rejected=await page.evaluate(()=>chrome.runtime.sendMessage({target:'engine',action:'inspect',payload:{url:'https://www.youtube.com/watch?v=testGood001'}}));assert.equal(rejected.ok,false);
  console.log('PASS: UI cannot call privileged engine directly');
  const background=await begin('testSlow001');await page.close();
  assert.equal((await terminal(background)).status,'complete');
  console.log('PASS: download continues with popup closed; no native helper permission');
 }finally{await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
