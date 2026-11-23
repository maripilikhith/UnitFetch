import {parseLink} from '../utils/url-utils.js';
import {directMetadata} from '../detector/direct-video.js';
import {streamNotice} from '../downloader/stream-capabilities.js';
import {nativeRequest} from './native-client.js';
import {history,updateHistory,clearHistory,isActive} from '../storage/history-manager.js';
import {settings,saveSettings} from '../storage/storage-manager.js';
import {downloadDirect,syncDirectDownloads} from '../downloader/direct-download.js';
import {isExtensionUI} from './side-panel.js';
import {candidateSource} from '../utils/video-context.js';

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
  if (candidate?.expires > Date.now() && candidateSource(candidate) === link.url) return {...candidate.video,token:candidate.token};
  await chrome.storage.session.set({inspection:{url:link.url,startedAt:Date.now()}});
  await chrome.storage.session.remove(['candidate','inspectionError']);
  try {
    let video;
    if (link.provider==='youtube') video = await nativeRequest('inspect',{url:link.url});
    else video = directMetadata(link) || await nativeRequest('probe',{url:link.url});
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
  try {await nativeRequest('download',{id,token:video.nativeToken,formatId:message.formatId},15000);}
  catch(error) {await updateHistory({...job,status:'failed',error:error.message});throw error;}
  return job;
}
export async function handleMessage(message, sender) {
  // Native commands must originate from our own UI, never from web pages or content scripts.
  if (!isExtensionUI(sender)) throw new Error('This action is only available in UniFetch.');
  if (!message || typeof message.type!=='string') throw new Error('Invalid request.');
  switch(message.type) {
    case 'GET_STATE': {
      await syncDirectDownloads();
      const session = await chrome.storage.session.get(['candidate','inspection','inspectionError']);
      return {history:await history(),settings:await settings(),...session};
    }
    case 'CONNECT': {
      const data = await nativeRequest('ping',{},45000);
      for (const job of data.jobs || []) await updateHistory(job);
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
      else await nativeRequest('cancel',{id:job.id},15000);
      return {ok:true};
    }
    case 'SHOW_FILE': {
      const job = (await history()).find(j=>j.id===message.id);
      if (!job || job.status!=='complete') throw new Error('This file is not ready.');
      if (job.downloadId != null) await chrome.downloads.show(job.downloadId);
      else await nativeRequest('reveal',{id:job.id},10000);
      return {ok:true};
    }
    case 'CLEAR_HISTORY': {
      // Purge helper records too, otherwise reconnect would restore cleared entries.
      const hasNative = (await history()).some(j=>j.provider==='youtube');
      if (hasNative) await nativeRequest('clear_history',{},10000);
      await clearHistory(); return {ok:true};
    }
    case 'SAVE_SETTINGS': return saveSettings(message.settings);
    case 'CLEAR_PREVIEW': await chrome.storage.session.remove('candidate'); return {ok:true};
    default: throw new Error('Unknown action.');
  }
}
