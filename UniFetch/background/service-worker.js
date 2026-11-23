import {handleMessage} from './message-handler.js';
import {onNativeEvent,nativeRequest} from './native-client.js';
import {updateHistory,history,isActive} from '../storage/history-manager.js';
import {syncDirectDownloads} from '../downloader/direct-download.js';
import {openSidePanel} from './side-panel.js';

chrome.runtime.onMessage.addListener((message,sender,respond) => {
  if (message?.type === 'OPEN_SIDE_PANEL') {
    try { openSidePanel(message,sender).then(()=>respond({ok:true,data:{opened:true}}),error=>respond({ok:false,error:error.message})); }
    catch(error) { respond({ok:false,error:error.message}); }
    return true;
  }
  handleMessage(message,sender).then(data=>respond({ok:true,data}),error=>respond({ok:false,error:error.message}));
  return true;
});
onNativeEvent(async message => {
  try {
    if (message.event==='job' && message.job?.id) await updateHistory(message.job);
    if (message.event==='disconnected') {
      const {candidate} = await chrome.storage.session.get('candidate');
      if (candidate?.video?.provider === 'youtube') await chrome.storage.session.remove('candidate');
      for (const job of (await history()).filter(j=>j.provider==='youtube' && isActive(j))) await updateHistory({...job,status:'interrupted',error:'The helper disconnected. Find the video again to retry.'});
    }
  } catch(error) {console.error('Could not save download state:',error.message);}
});
chrome.downloads.onChanged.addListener(()=>syncDirectDownloads().catch(error=>console.error('Download state error:',error.message)));
chrome.runtime.onStartup.addListener(()=>nativeRequest('ping',{},12000).then(async data=>{for(const job of data.jobs || []) await updateHistory(job);}).catch(()=>{}));
