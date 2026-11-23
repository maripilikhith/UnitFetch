import {duration,bytes,statusLabel,dateLabel} from '../utils/format-utils.js';
import {chooseFormat} from '../utils/video-context.js';

export function node(tag,className,text) {
  const el=document.createElement(tag);
  if(className) el.className=className;
  if(text!=null) el.textContent=text;
  return el;
}
export function icon(name) {
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('aria-hidden','true');
  const use=document.createElementNS(svg.namespaceURI,'use');
  use.setAttribute('href',chrome.runtime.getURL(`assets/ui-icons.svg#${name}`));
  svg.append(use);return svg;
}
export const isActive=job=>['queued','downloading','processing'].includes(job.status);

function radio(name,value,label,checked,onChange) {
  const wrapper=node('label','choice');
  const input=node('input');input.type='radio';input.name=name;input.value=value;input.checked=checked;
  input.addEventListener('change',()=>{if(input.checked)onChange(value);});
  wrapper.append(input,node('span','',label));return wrapper;
}

export function videoCard(video,prefs,onDownload) {
  let selected=chooseFormat(video.formats,prefs.quality);
  const heading=node('div','video-heading');
  if(video.thumbnail) {
    const image=node('img','video-thumb');image.src=video.thumbnail;image.alt='';image.referrerPolicy='no-referrer';
    image.addEventListener('error',()=>image.remove(),{once:true});heading.append(image);
  }
  const details=node('div');details.append(node('h2','',video.title));
  details.append(node('p','video-meta',[video.author||video.hostname,video.duration!=null?duration(video.duration):null].filter(Boolean).join(' · ')));
  heading.append(details);
  const controls=node('div','format-controls');
  const containers=node('fieldset','choice-group');containers.append(node('legend','','File type'));
  const typeOptions=node('div','container-choices');
  const quality=node('fieldset','choice-group');quality.append(node('legend','','Quality'));
  const qualityOptions=node('div','choices');quality.append(qualityOptions);
  const summary=node('div','result-summary');
  const audio=node('span','with-audio');
  if(video.provider==='youtube')audio.append(icon('check'));
  audio.append(node('span','',video.provider==='youtube'?'Video + audio':'Original file'));
  const size=node('span');summary.append(audio,size);
  const download=node('button','primary download-action');download.id='download-video';
  download.append(node('span','','Download video'),icon('download'));
  function updateSummary() {size.textContent=selected.filesize?`~${bytes(selected.filesize)}`:'Size unknown';download.dataset.formatId=selected.id;}
  function renderQuality() {
    qualityOptions.replaceChildren();
    for(const format of video.formats.filter(f=>f.ext===selected.ext)) {
      const label=format.height===2160?'4K':format.height===4320?'8K':format.height?`${format.height}p`:'Original';
      const choice=radio('video-quality',format.id,label,format.id===selected.id,()=>{selected=format;updateSummary();});
      choice.title=format.height?`${format.height}p · ${format.ext.toUpperCase()}`:'Original file';
      qualityOptions.append(choice);
    }
    updateSummary();
  }
  for(const ext of [...new Set(video.formats.map(f=>f.ext))]) {
    typeOptions.append(radio('file-type',ext,ext.toUpperCase(),ext===selected.ext,()=>{
      selected=chooseFormat(video.formats,prefs.quality,ext,selected.height);renderQuality();
    }));
  }
  containers.append(typeOptions);controls.append(containers,quality,summary,download);renderQuality();
  download.addEventListener('click',async()=>{
    download.disabled=true;
    try {await onDownload(video,selected.id);} finally {download.disabled=false;}
  });
  const parts=[heading,controls];
  if(video.notice)parts.push(node('p','hint',video.notice));
  return parts;
}

export function jobRow(job,{cancel,reveal,retry}) {
  const row=node('article','download-row');row.dataset.jobId=job.id;
  row.append(node('h3','',job.title||job.filename||'Video'));
  const info=node('div','download-info');info.append(node('span','',statusLabel(job)));
  if(isActive(job)) {
    const button=node('button','text-button','Cancel');
    button.addEventListener('click',async()=>{button.disabled=true;try{await cancel(job);}finally{button.disabled=false;}});info.append(button);
  } else if(job.status==='complete') {
    const button=node('button','text-button','Show file');button.addEventListener('click',()=>reveal(job));info.append(button);
  } else if(job.videoId) {
    const button=node('button','text-button','Try again');button.addEventListener('click',()=>retry(job));info.append(button);
  }
  row.append(info);
  if(isActive(job)) {
    const progress=node('progress');progress.max=100;progress.setAttribute('aria-label',`${job.title} download progress`);
    if(Number.isFinite(job.progress))progress.value=job.progress;
    row.append(progress);
    const parts=[Number.isFinite(job.progress)?`${Math.round(job.progress)}% of current stream`:null,bytes(job.bytes),job.speed?`${bytes(job.speed)}/s`:null].filter(Boolean);
    row.append(node('div','download-info',parts.join(' · ')||'Preparing the file…'));
  } else row.append(node('p','hint',`${job.hostname||''} · ${dateLabel(job.createdAt)}`));
  if(job.error)row.append(node('p','download-error',job.error));
  return row;
}
