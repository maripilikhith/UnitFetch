import {safeFilename} from './filename-manager.js';
import {settings} from '../storage/storage-manager.js';
import {history, updateHistory, isActive} from '../storage/history-manager.js';
export async function downloadDirect(video) {
  const list = await history();
  // A digest avoids retaining signed URLs in the extension's persistent history.
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(video.url));
  const sourceKey = [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
  if (list.some(j=>j.sourceKey===sourceKey && isActive(j))) throw new Error('This file is already downloading.');
  const prefs = await settings();
  const filename = safeFilename(video.title,video.formats[0].ext);
  const downloadId = await chrome.downloads.download({url:video.url,filename:`UniFetch/${filename}`,saveAs:prefs.saveAs,conflictAction:'uniquify'});
  const job = {id:`chrome-${downloadId}`,downloadId,sourceKey,title:video.title,filename,provider:'direct',hostname:video.hostname,format:video.formats[0].ext,createdAt:Date.now(),status:'downloading',progress:null};
  await updateHistory(job);
  // Search also catches completion that raced ahead of the history insert.
  await syncDirectDownloads();
  return job;
}
export async function syncDirectDownloads() {
  for (const job of (await history()).filter(j=>j.downloadId != null && isActive(j))) {
    const [item] = await chrome.downloads.search({id:job.downloadId});
    if (!item) {await updateHistory({...job,status:'interrupted',error:'Chrome no longer has this download.'});continue;}
    await updateHistory({...job,status:item.state==='complete'?'complete':item.state==='interrupted'?(item.error==='USER_CANCELED'?'cancelled':'failed'):'downloading',progress:item.totalBytes>0?Math.min(100,item.bytesReceived/item.totalBytes*100):null,bytes:item.bytesReceived,totalBytes:item.totalBytes,error:item.error || null});
  }
}
