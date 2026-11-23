import {handleMessage} from './message-handler.js';
import {onNativeEvent,nativeRequest} from './native-client.js';
import {updateHistory,history,isActive} from '../storage/history-manager.js';
import {syncDirectDownloads} from '../downloader/direct-download.js';

chrome.runtime.onMessage.addListener((message,sender,respond) => {
  handleMessage(message,sender).then(data=>respond({ok:true,data}),error=>respond({ok:false,error:error.message}));
  return true;
});
onNativeEvent(async message => {
  try {
    if (message.event==='job' && message.job?.id) await updateHistory(message.job);
    if (message.event==='disconnected') {
      for (const job of (await history()).filter(j=>j.provider==='youtube' && isActive(j))) await updateHistory({...job,status:'interrupted',error:'The helper disconnected. Find the video again to retry.'});
    }
  } catch(error) {console.error('Could not save download state:',error.message);}
});
chrome.downloads.onChanged.addListener(()=>syncDirectDownloads().catch(error=>console.error('Download state error:',error.message)));
chrome.runtime.onStartup.addListener(()=>nativeRequest('ping',{},12000).then(async data=>{for(const job of data.jobs || []) await updateHistory(job);}).catch(()=>{}));
