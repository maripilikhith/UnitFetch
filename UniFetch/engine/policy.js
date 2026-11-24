export const MAX_BYTES=256*1024*1024;
export function allowedEngineUrl(value) {
  try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtubei.googleapis.com'].includes(u.hostname)||u.hostname.endsWith('.googlevideo.com'));}catch{return false;}
}
export function formatOptions(formats) {
  const pairs=[];
  for(const ext of ['mp4','webm']) {
    const matching=formats.filter(f=>f.mimeType?.split(';')[0].endsWith(`/${ext}`));
    const audios=matching.filter(f=>f.hasAudio&&!f.hasVideo&&!f.isDubbed&&!f.isDescriptive&&!f.isAutoDubbed);
    audios.sort((a,b)=>Number(b.isOriginal)-Number(a.isOriginal)||Number((b.numChannels||2)<=2)-Number((a.numChannels||2)<=2)||(b.bitrate||0)-(a.bitrate||0));
    const audio=audios[0];if(!audio)continue;
    const videos=matching.filter(f=>f.hasVideo&&!f.hasAudio&&!f.isHdr);
    videos.sort((a,b)=>Number(/avc1|vp0?9/.test(b.mimeType))-Number(/avc1|vp0?9/.test(a.mimeType))||(b.bitrate||0)-(a.bitrate||0));
    const heights=new Set();
    for(const video of videos) {
      if(!video.height||heights.has(video.height))continue;
      const size=video.contentLength&&audio.contentLength?video.contentLength+audio.contentLength:null;
      if(size>MAX_BYTES)continue;
      heights.add(video.height);
      pairs.push({id:`${video.itag}:${audio.itag}`,ext,height:video.height,filesize:size,label:`${video.height}p · ${ext.toUpperCase()} · video + audio`,video,audio});
    }
  }
  return pairs.sort((a,b)=>b.height-a.height||a.ext.localeCompare(b.ext));
}
