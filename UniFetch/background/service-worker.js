import {handleMessage} from './message-handler.js';
import {browserRequest} from './browser-client.js';
import {updateHistory,history,isActive} from '../storage/history-manager.js';
import {syncDirectDownloads} from '../downloader/direct-download.js';
import {safeFilename} from '../downloader/filename-manager.js';
import {settings} from '../storage/storage-manager.js';
import {openSidePanel} from './side-panel.js';

async function engineEvent(message,sender) {
  if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('engine/offscreen.html'))throw new Error('Invalid engine event.');
  if(message.type==='ENGINE_HEARTBEAT')return {};
  const id=message.id||message.job?.id;
  const job=(await history()).find(j=>j.id===id);
  if(!job||job.provider!=='youtube')throw new Error('Unknown download.');
  if(message.type==='ENGINE_JOB') {
    await updateHistory({...job,...message.job},{onlyActive:true,engineOnly:true});
    return {};
  }
  if(message.type==='ENGINE_SAVE') {
    if(!isActive(job))throw new Error('Download cancelled.');
    if(!message.url?.startsWith(`blob:${chrome.runtime.getURL('')}`)||!['mp4','webm'].includes(message.ext))throw new Error('Invalid output file.');
    const filename=safeFilename(job.title,message.ext),prefs=await settings();
    const downloadId=await chrome.downloads.download({url:message.url,filename:`UniFetch/${filename}`,saveAs:prefs.saveAs,conflictAction:'uniquify'});
    const latest=(await history()).find(j=>j.id===id);
    if(!latest||!isActive(latest)){await chrome.downloads.cancel(downloadId);await browserRequest('release',{id});return {};}
    if(!await updateHistory({...latest,downloadId,filename,status:'downloading',progress:null},{onlyActive:true})) {
      await chrome.downloads.cancel(downloadId);await browserRequest('release',{id});return {};
    }
    await synchronize();return {downloadId};
  }
  throw new Error('Unknown engine event.');
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.target==='engine')return;
  if(message?.type==='OPEN_SIDE_PANEL') {
    try {openSidePanel(message,sender).then(()=>respond({ok:true,data:{opened:true}}),error=>respond({ok:false,error:error.message}));}
    catch(error){respond({ok:false,error:error.message});}return true;
  }
  const task=message?.type?.startsWith('ENGINE_')?engineEvent(message,sender):handleMessage(message,sender);
  task.then(data=>respond({ok:true,data}),error=>respond({ok:false,error:error.message}));return true;
});
let syncing=Promise.resolve();
function synchronize() {
  const task=syncing.then(async()=>{
    await syncDirectDownloads();
    if(await chrome.offscreen.hasDocument()) {
      const state=await browserRequest('ping');
      for(const job of (await history()).filter(j=>j.provider==='youtube'&&!isActive(j)&&state.activeIds.includes(j.id)))await browserRequest('release',{id:job.id});
    }
  });
  syncing=task.catch(()=>{});return task;
}
chrome.downloads.onChanged.addListener(()=>synchronize().catch(()=>{}));
chrome.runtime.onStartup.addListener(async()=>{
  await chrome.storage.session.remove(['candidate','inspection']);
  for(const job of (await history()).filter(j=>j.provider==='youtube'&&isActive(j)&&j.downloadId==null))await updateHistory({...job,status:'interrupted',error:'Chrome restarted. Find the video again to retry.'});
  await synchronize();
});
