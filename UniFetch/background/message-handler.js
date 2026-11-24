import {parseLink} from '../utils/url-utils.js';
import {directMetadata} from '../detector/direct-video.js';
import {streamNotice} from '../downloader/stream-capabilities.js';
import {browserRequest} from './browser-client.js';
import {history,updateHistory,clearHistory,isActive} from '../storage/history-manager.js';
import {settings,saveSettings} from '../storage/storage-manager.js';
import {downloadDirect,syncDirectDownloads} from '../downloader/direct-download.js';
import {isExtensionUI} from './side-panel.js';
import {candidateSource} from '../utils/video-context.js';
import {APP_VERSION} from '../utils/version.js';

let startChain = Promise.resolve();
let inspectionTask = null;
function inspect(input) {
  const link = parseLink(input);
  if (link.provider === 'stream') throw new Error(streamNotice(link.extension));
  if (inspectionTask) {
    if (inspectionTask.url === link.url) return inspectionTask.promise;
    return inspectionTask.promise.catch(()=>{}).then(()=>inspect(input));
  }
  const promise = inspectMedia(link).finally(()=>{inspectionTask = null;});
  inspectionTask = {url:link.url,promise};
  return promise;
}
async function inspectMedia(link) {
  const {candidate} = await chrome.storage.session.get('candidate');
  if (candidate?.expires > Date.now() && candidateSource(candidate) === link.url) {
    const valid=link.provider!=='youtube'||(candidate.video.engineToken&&(await browserRequest('has_preview',{token:candidate.video.engineToken})).valid);
    if(valid)return {...candidate.video,token:candidate.token};
  }
  await chrome.storage.session.set({inspection:{url:link.url,startedAt:Date.now()}});
  await chrome.storage.session.remove(['candidate','inspectionError']);
  try {
    let video;
    if (link.provider==='youtube') video = await browserRequest('inspect',{url:link.url});
    else {video = directMetadata(link); if(!video)throw new Error('Use a direct .mp4, .webm, .m4v, or .mov file link. Other websites are not supported yet.');}
    const token = crypto.randomUUID();
    // Session storage is not exposed to page content scripts; signed URLs expire with the browser session.
    await chrome.storage.session.set({candidate:{token,sourceUrl:link.url,video,expires:Date.now()+15*60*1000}});
    return {...video,token};
  } catch(error) {
    await chrome.storage.session.set({inspectionError:{url:link.url,message:error.message,at:Date.now()}});
    throw error;
  } finally {await chrome.storage.session.remove('inspection');}
}
async function download(message) {
  const {candidate} = await chrome.storage.session.get('candidate');
  if (!candidate || candidate.token !== message.token || candidate.expires < Date.now()) throw new Error('This video preview has expired. Find the video again.');
  const video = candidate.video;
  if (!video.formats.some(f=>f.id===message.formatId)) throw new Error('Choose one of the available formats.');
  if (video.provider === 'direct') return downloadDirect(video);
  const active = (await history()).filter(isActive);
  if (active.some(j=>j.provider==='youtube')) throw new Error('One YouTube download can run at a time. Wait for it to finish or cancel it.');
  const id = crypto.randomUUID();
  const job = {id,title:video.title,provider:'youtube',hostname:'youtube.com',videoId:video.id,createdAt:Date.now(),status:'queued',progress:null,format:video.formats.find(f=>f.id===message.formatId)?.label};
  await updateHistory(job);
  try {await browserRequest('download',{id,token:video.engineToken,formatId:message.formatId});}
  catch(error) {await updateHistory({...job,status:'failed',error:error.message});throw error;}
  return job;
}
export async function handleMessage(message, sender) {
  // Engine commands must originate from our own UI, never from web pages or content scripts.
  if (!isExtensionUI(sender)) throw new Error('This action is only available in UniFetch.');
  if (!message || typeof message.type!=='string') throw new Error('Invalid request.');
  switch(message.type) {
    case 'GET_STATE': {
      await syncDirectDownloads();
      const session = await chrome.storage.session.get(['candidate','inspection','inspectionError']);
      return {backgroundVersion:APP_VERSION,history:await history(),settings:await settings(),...session};
    }
    case 'CONNECT': {
      await startChain;
      const data = await browserRequest('ping');
      for (const job of (await history()).filter(j=>j.provider==='youtube' && isActive(j) && j.downloadId==null && !data.activeIds.includes(j.id))) await updateHistory({...job,status:'interrupted',error:'The browser restarted. Find the video again to retry.'});
      return data;
    }
    case 'INSPECT': return inspect(message.url);
    case 'DOWNLOAD': {
      const operation = startChain.then(()=>download(message));
      startChain = operation.catch(()=>{});
      return operation;
    }
    case 'CANCEL': {
      const job = (await history()).find(j=>j.id===message.id);
      if (!job || !isActive(job)) throw new Error('This download is no longer active.');
      if (job.downloadId != null) {await chrome.downloads.cancel(job.downloadId); await syncDirectDownloads();}
      else {await browserRequest('cancel',{id:job.id});await updateHistory({...job,status:'cancelled',error:null});}
      return {ok:true};
    }
    case 'SHOW_FILE': {
      const job = (await history()).find(j=>j.id===message.id);
      if (!job || job.status!=='complete') throw new Error('This file is not ready.');
      if (job.downloadId != null) await chrome.downloads.show(job.downloadId);
      else throw new Error('This is a download from an older version. Find it in Downloads / UniFetch.');
      return {ok:true};
    }
    case 'CLEAR_HISTORY': {
      await clearHistory(); return {ok:true};
    }
    case 'SAVE_SETTINGS': return saveSettings(message.settings);
    case 'CLEAR_PREVIEW': await chrome.storage.session.remove('candidate'); return {ok:true};
    default: throw new Error('Unknown action.');
  }
}
