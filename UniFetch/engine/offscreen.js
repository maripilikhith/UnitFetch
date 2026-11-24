import * as library from '../vendor/engine.js';
import {MAX_BYTES,allowedEngineUrl,formatOptions} from './policy.js';
import {remuxTracks} from './remux.js';
import {parseLink} from '../utils/url-utils.js';
import {APP_VERSION} from '../utils/version.js';
const {Innertube,Utils,Constants,Log,SabrStream,buildSabrFormat,EnabledTrackTypes,Logger}=library;
Log.setLevel();Logger.getInstance().setLogLevels();
const frame=document.querySelector('#player');
const frameReady=new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));
frame.src='sandbox.html';
const evaluations=new Map(), previews=new Map(), blobs=new Map(), jobs=new Map();
addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||event.origin!=='null')return;
  const pending=evaluations.get(event.data?.id);if(!pending)return;
  clearTimeout(pending.timer);evaluations.delete(event.data.id);
  if(event.data.error)pending.reject(new Error(event.data.error));else pending.resolve(event.data.result);
});
Utils.Platform.shim.eval=async data=>{
  await frameReady;
  return new Promise((resolve,reject)=>{
    const id=crypto.randomUUID();
    const timer=setTimeout(()=>{evaluations.delete(id);reject(new Error('YouTube player processing timed out. Reload UniFetch to retry.'));},15000);
    evaluations.set(id,{resolve,reject,timer});frame.contentWindow.postMessage({type:'EVALUATE_PLAYER',id,code:data.output},'*');
  });
};
async function engineFetch(input,init={}) {
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  if(!allowedEngineUrl(url))throw new Error('The media server is not supported.');
  const headers=new Headers(init.headers||(input instanceof Request?input.headers:undefined));
  headers.delete('cookie');headers.delete('authorization');
  const signals=[AbortSignal.timeout(30000),init.signal||(input instanceof Request?input.signal:null)].filter(Boolean);
  const response=await fetch(input,{...init,headers,credentials:'omit',redirect:'error',signal:AbortSignal.any(signals)});
  if(!response.ok)throw new Error(`YouTube ${new URL(url).hostname}${new URL(url).pathname} returned HTTP ${response.status}. This video may not be available for browser downloads.`);
  return response;
}
let client;
async function youtube(){return client??=Innertube.create({lang:'en',fetch:engineFetch}).catch(error=>{client=null;throw error;});}
const configOf=info=>info.player_config?.media_common_config?.media_ustreamer_request_config?.video_playback_ustreamer_config;
function friendly(error) {
  if(error?.name==='TimeoutError')return 'YouTube did not respond in time. Try again.';
  const message=String(error?.message||'The browser download failed.');
  if(/attestation|verification|proof.of.origin/i.test(message))return 'YouTube requires verification for this download. The browser edition cannot download this video. No partial file was saved.';
  if(/fetch|network/i.test(message))return 'Could not reach YouTube. Check your connection; this video may require verification that the browser edition does not support.';
  return message.replace(/https?:\/\/\S+/g,'[media server]').slice(0,500);
}
async function inspect(url) {
  const link=parseLink(url);if(link.provider!=='youtube')throw new Error('Use a YouTube video link.');
  const yt=await youtube(), info=await yt.getBasicInfo(link.id);
  if(info.playability_status?.status!=='OK')throw new Error('YouTube is not allowing anonymous playback of this video. Private, age-restricted, region-blocked, and verification-required videos are not supported.');
  if(info.basic_info?.is_live||info.basic_info?.is_upcoming)throw new Error('Live and upcoming videos are not supported. Try a finished video.');
  const originals=info.streaming_data?.adaptive_formats||[];
  if(originals.some(f=>f.drm_families?.length))throw new Error('Protected videos are not supported.');
  const formats=originals.map(buildSabrFormat), pairs=formatOptions(formats);
  if(!pairs.length)throw new Error('No compatible video + audio option fits the 256 MB browser limit. Try a shorter video.');
  const token=crypto.randomUUID();
  for(const [key,value] of previews)if(value.expires<Date.now())previews.delete(key);
  if(previews.size>=3)previews.delete(previews.keys().next().value);
  previews.set(token,{info,pairs,formats,originals,id:link.id,expires:Date.now()+15*60*1000});
  return {id:link.id,url:link.url,title:info.basic_info.title||'YouTube video',author:info.basic_info.author||'',duration:info.basic_info.duration||0,thumbnail:info.basic_info.thumbnail?.at(-1)?.url||'',provider:'youtube',engineToken:token,formats:pairs.map(({video,audio,...publicFormat})=>publicFormat)};
}
async function send(type,data) {
  const response=await chrome.runtime.sendMessage({type,...data});
  if(!response?.ok)throw new Error(response?.error||'Could not save download state.');
  return response.data;
}
async function run(job,preview,pair) {
  const {id,controller}=job, signal=controller.signal;
  let stream,bytes=0,lastProgress=0;
  const heartbeat=setInterval(()=>send('ENGINE_HEARTBEAT',{}).catch(()=>{}),15000);
  const timer=setTimeout(()=>controller.abort(new Error('The download exceeded the 10 minute browser time limit. Try a lower quality.')),10*60*1000);
  async function collect(readable) {
    const reader=readable.getReader(),chunks=[];
    try {
      while(true) {
        signal.throwIfAborted();
        const {done,value}=await reader.read();if(done)break;
        bytes+=value.byteLength;
        if(bytes>MAX_BYTES)throw new Error('This download exceeds the 256 MB browser limit. Choose a lower quality or shorter video.');
        chunks.push(value);
        if(Date.now()-lastProgress>700){lastProgress=Date.now();await send('ENGINE_JOB',{job:{id,status:'downloading',bytes,totalBytes:pair.filesize,progress:pair.filesize?Math.min(99,bytes/pair.filesize*100):null}});}
      }
      return new Blob(chunks);
    }catch(error){controller.abort(error);throw error;}
    finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
  }
  try {
    await send('ENGINE_JOB',{job:{id,status:'downloading',progress:null}});
    const yt=await youtube();signal.throwIfAborted();
    let videoStream,audioStream;
    if(preview.info.streaming_data.server_abr_streaming_url&&configOf(preview.info)) {
      stream=new SabrStream({videoId:preview.id,formats:preview.formats,fetchFunction:(input,init={})=>engineFetch(input,{...init,signal:AbortSignal.any([signal,init.signal].filter(Boolean))}),serverAbrStreamingUrl:await yt.session.player.decipher(preview.info.streaming_data.server_abr_streaming_url),videoPlaybackUstreamerConfig:configOf(preview.info),clientInfo:{clientName:Number(Constants.CLIENT_NAME_IDS[yt.session.context.client.clientName]),clientVersion:yt.session.context.client.clientVersion},callbacks:{onMintPoToken:async()=>{throw new Error('YouTube requires verification for this download. The browser edition cannot download this video.');}}});
      signal.addEventListener('abort',()=>stream.abort(),{once:true});
      stream.on('streamProtectionStatusUpdate',status=>{
        if(status.status===2||status.status===3)controller.abort(new Error('YouTube verification required.'));
      });
      ({videoStream,audioStream}=stream.start({videoFormat:pair.video,audioFormat:pair.audio,enabledTrackTypes:EnabledTrackTypes.VIDEO_AND_AUDIO,isPostLiveDvr:false,maxRetries:1,stallDetectionMs:20000}));
    }else {
      [videoStream,audioStream]=await Promise.all([pair.video,pair.audio].map(async f=>{
        const original=preview.originals.find(item=>item.itag===f.itag);
        const response=await engineFetch(await original.decipher(yt.session.player),{signal});return response.body;
      }));
    }
    const tracks=await Promise.all([collect(videoStream),collect(audioStream)]);signal.throwIfAborted();
    await send('ENGINE_JOB',{job:{id,status:'processing',progress:null,bytes}});
    const blob=await remuxTracks(library,...tracks,pair.ext,signal);signal.throwIfAborted();
    // Reject truncated streams even when a transport closes without reporting an error.
    const input=new library.Input({formats:[library.MP4,library.WEBM],source:new library.BlobSource(blob)});
    try {
      const [v,a]=await Promise.all([input.getPrimaryVideoTrack(),input.getPrimaryAudioTrack()]);
      if(!v||!a)throw new Error('The result is missing a video or audio track.');
      const durations=await Promise.all([v.computeDuration(),a.computeDuration()]);
      const expected=Number(preview.info.basic_info.duration);
      if(durations.some(d=>!Number.isFinite(d)||d<=0||(expected>0&&d<expected-Math.max(2,expected*0.02))))throw new Error('YouTube stopped the stream before it finished. No partial file was saved.');
    }finally{input.dispose();}
    signal.throwIfAborted();
    const url=URL.createObjectURL(blob);blobs.set(id,url);
    await send('ENGINE_SAVE',{id,url,ext:pair.ext});
  }catch(error) {
    controller.abort(error);
    const url=blobs.get(id);if(url){URL.revokeObjectURL(url);blobs.delete(id);}
    await send('ENGINE_JOB',{job:{id,status:job.cancelled?'cancelled':'failed',error:job.cancelled?null:friendly(signal.reason||error),progress:null}}).catch(()=>{});
  }finally {clearInterval(heartbeat);clearTimeout(timer);await stream?.abort();jobs.delete(id);}
}
async function command(action,payload) {
  switch(action) {
    case 'ping':return {version:APP_VERSION,mode:'browser',activeIds:[...jobs.keys(),...blobs.keys()]};
    case 'inspect':return inspect(payload.url);
    case 'has_preview':return {valid:(previews.get(payload.token)?.expires||0)>Date.now()};
    case 'download': {
      if(jobs.size||blobs.size)throw new Error('Finish or cancel the current browser download first.');
      const preview=previews.get(payload.token),pair=preview?.pairs.find(f=>f.id===payload.formatId);
      if(!pair||preview.expires<Date.now())throw new Error('This preview has expired. Find the video again.');
      const job={id:payload.id,controller:new AbortController()};jobs.set(job.id,job);
      void run(job,preview,pair);return {started:true};
    }
    case 'cancel': {const job=jobs.get(payload.id);if(job){job.cancelled=true;job.controller.abort(new Error('Cancelled'));}return {ok:true};}
    case 'release': {const url=blobs.get(payload.id);if(url){URL.revokeObjectURL(url);blobs.delete(payload.id);}return {ok:true};}
    default:throw new Error('Unsupported browser engine action.');
  }
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.target!=='engine')return;
  if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('background/service-worker.js')){respond({ok:false,error:'Invalid engine caller.'});return;}
  command(message.action,message.payload||{}).then(data=>respond({ok:true,data}),error=>respond({ok:false,error:friendly(error)}));return true;
});
