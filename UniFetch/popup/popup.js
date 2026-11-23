import {parseLink} from '../utils/url-utils.js';
import {duration,bytes,statusLabel,dateLabel} from '../utils/format-utils.js';
const $ = selector => document.querySelector(selector);
$('#app-version').textContent=`v${chrome.runtime.getManifest().version}`;
let video = null, jobs = [], prefs = {quality:'1080',saveAs:true}, busy = false, pollTimer = null;
async function request(type, data = {}) {
  const result = await chrome.runtime.sendMessage({type,...data});
  if (!result?.ok) throw new Error(result?.error || 'UniFetch could not reach its background process. Reload the extension.');
  return result.data;
}
function node(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text != null) result.textContent = text;
  return result;
}
function notice(text='', type='') {
  const box = $('#status');box.textContent = text;box.className = `notice ${type}`;box.hidden = !text;
}
function setBusy(value) {
  busy = value;
  for (const id of ['#inspect','#video-url','#clear-url','#current-tab']) $(id).disabled = value;
  $('#inspect span').textContent = value ? 'Finding…' : 'Find video';
}
function showView(name) {
  for (const view of ['fetch','history','settings']) $(`#${view}-view`).hidden = view!==name;
  for (const tab of document.querySelectorAll('[data-view]')) {
    const selected = tab.dataset.view===name;tab.classList.toggle('active',selected);
    if (selected) tab.setAttribute('aria-current','page'); else tab.removeAttribute('aria-current');
  }
}
function updateProvider() {
  let label = 'Auto-detect';
  if ($('#video-url').value.trim()) {
    try { const link = parseLink($('#video-url').value); label = link.provider==='youtube'?'YouTube':link.provider==='stream'?'Stream':'Video link'; }
    catch { label = 'Check link'; }
  }
  $('#provider').textContent = label;
}
function selectPreferredFormat(formats) {
  const cap = prefs.quality==='best'?Infinity:Number(prefs.quality);
  return formats.find(f=>f.height && f.height<=cap)?.id || formats.at(-1)?.id;
}
function renderVideo(candidate) {
  video = candidate?.video ? {...candidate.video,token:candidate.token} : null;
  const box = $('#video-result'); box.replaceChildren(); box.hidden = !video;
  $('#welcome').hidden = Boolean(video) || jobs.some(isActive);
  if (!video) return;
  const heading = node('div','video-heading');
  if (video.thumbnail) {
    const img = node('img','video-thumb'); img.src=video.thumbnail; img.alt=''; img.referrerPolicy='no-referrer';
    img.addEventListener('error',()=>img.remove(),{once:true});heading.append(img);
  }
  const info = node('div'); info.append(node('h2','',video.title));
  info.append(node('p','video-meta',[video.author || video.hostname,video.duration != null?duration(video.duration):null].filter(Boolean).join(' · ')));
  heading.append(info);box.append(heading);
  const line = node('div','format-line'), label = node('label','','Save as');label.htmlFor='format-select';
  const select = node('select');select.id='format-select';
  for (const format of video.formats) {const option=node('option','',format.label+(format.filesize?` · ~${bytes(format.filesize)}`:''));option.value=format.id;select.append(option);}
  select.value = selectPreferredFormat(video.formats);line.append(label,select);box.append(line);
  const button = node('button','primary download-action','Download video');button.id='download-video';
  button.addEventListener('click',async()=>{
    button.disabled=true;
    try {await request('DOWNLOAD',{token:video.token,formatId:select.value});notice('Download started. You can close this popup.');await refresh();}
    catch(error) {notice(error.message,'error');}
    finally {button.disabled=false;}
  });
  box.append(button);
  if (video.notice) box.append(node('p','hint',video.notice));
}
const isActive = job => ['queued','downloading','processing'].includes(job.status);
function jobRow(job) {
  const row = node('article','download-row');row.dataset.jobId=job.id;row.append(node('h3','',job.title || job.filename || 'Video'));
  const info = node('div','download-info');info.append(node('span','',statusLabel(job)));
  if (isActive(job)) {
    const cancel = node('button','text-button','Cancel');
    cancel.addEventListener('click',async()=>{cancel.disabled=true;try{await request('CANCEL',{id:job.id});await refresh();}catch(e){notice(e.message,'error');showView('fetch');}finally{cancel.disabled=false;}});info.append(cancel);
  } else if (job.status==='complete') {
    const show = node('button','text-button','Show file');show.addEventListener('click',()=>request('SHOW_FILE',{id:job.id}).catch(e=>{notice(e.message,'error');showView('fetch');}));info.append(show);
  } else if (job.videoId) {
    const retry = node('button','text-button','Try again');retry.addEventListener('click',()=>{$('#video-url').value=`https://www.youtube.com/watch?v=${job.videoId}`;updateProvider();showView('fetch');$('#video-url').focus();});info.append(retry);
  }
  row.append(info);
  if (isActive(job)) {
    const progress = node('progress');progress.max=100;progress.setAttribute('aria-label',`${job.title} download progress`);
    if (Number.isFinite(job.progress)) progress.value=job.progress;
    row.append(progress);
    const parts = [Number.isFinite(job.progress)?`${Math.round(job.progress)}% of current stream`:null,bytes(job.bytes),job.speed?`${bytes(job.speed)}/s`:null].filter(Boolean);
    row.append(node('div','download-info',parts.join(' · ') || 'Preparing the file…'));
  } else row.append(node('p','hint',`${job.hostname || ''} · ${dateLabel(job.createdAt)}`));
  if (job.error) row.append(node('p','download-error',job.error));
  return row;
}
function renderHistory(next) {
  jobs = next;$('#history-count').textContent=String(jobs.length);
  const active=jobs.filter(isActive);$('#active-downloads').replaceChildren(...active.map(jobRow));
  const list=$('#history-list');list.replaceChildren(...jobs.map(jobRow));
  if (!jobs.length) {const empty=node('div','empty');empty.append(node('strong','','Your collection starts with a link.'),node('span','','Saved videos and their progress will appear here.'));list.append(empty);}
  $('#clear-history').disabled=!jobs.some(j=>!isActive(j));$('#welcome').hidden=Boolean(video) || active.length>0;
  clearTimeout(pollTimer);
  if(active.some(j=>j.downloadId != null)) pollTimer=setTimeout(()=>refresh().catch(e=>notice(e.message,'error')),1500);
}
async function refresh() {
  const state=await request('GET_STATE');prefs=state.settings;renderHistory(state.history);
  $('#quality-setting').value=prefs.quality;$('#save-as-setting').checked=prefs.saveAs;
  if(state.candidate && state.candidate.expires>Date.now() && state.candidate.token!==video?.token) renderVideo(state.candidate);
  if(state.inspection?.startedAt>Date.now()-120000){setBusy(true);notice('Finding available formats…','loading');$('#video-url').value=state.inspection.url;updateProvider();}
}
async function connect() {
  $('#connection').className='connection';$('#connection span').textContent='Connecting to your PC…';
  try {
    const data=await request('CONNECT');$('#connection').className='connection ready';$('#connection span').textContent='Local helper connected';
    $('#helper-detail').textContent=`yt-dlp ${data.tools.ytDlp}. Files save to ${data.downloadDirectory}.`;
  } catch(error) {$('#connection').className='connection error';$('#connection span').textContent='Local helper needs setup';$('#helper-detail').textContent=error.message;}
}
$('#link-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  try {
    const link=parseLink($('#video-url').value);setBusy(true);renderVideo(null);notice(`Finding available formats${link.provider==='youtube'?' on YouTube':''}…`,'loading');
    const result=await request('INSPECT',{url:link.url});renderVideo({token:result.token,video:result});notice();
  } catch(error) {notice(error.message,'error');} finally {setBusy(false);}
});
$('#video-url').addEventListener('input',()=>{updateProvider();if(video){renderVideo(null);request('CLEAR_PREVIEW').catch(e=>notice(e.message,'error'));}});
$('#clear-url').addEventListener('click',async()=>{$('#video-url').value='';updateProvider();renderVideo(null);notice();try{await request('CLEAR_PREVIEW');}catch(e){notice(e.message,'error');}$('#video-url').focus();});
$('#current-tab').addEventListener('click',async()=>{
  try {const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.url || !/^https?:/.test(tab.url)) throw new Error('Open a video page, then use the toolbar popup to capture its link.');$('#video-url').value=tab.url;updateProvider();$('#video-url').focus();}
  catch(error) {notice(error.message,'error');}
});
$('#expand').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('popup/popup.html')}));
for(const tab of document.querySelectorAll('[data-view]')) tab.addEventListener('click',()=>showView(tab.dataset.view));
$('#settings-button').addEventListener('click',()=>showView('settings'));$('#reconnect').addEventListener('click',connect);
$('#clear-history').addEventListener('click',async()=>{try{await request('CLEAR_HISTORY');await refresh();}catch(e){notice(e.message,'error');showView('fetch');}});
for(const id of ['#quality-setting','#save-as-setting']) $(id).addEventListener('change',async()=>{
  try {prefs=await request('SAVE_SETTINGS',{settings:{quality:$('#quality-setting').value,saveAs:$('#save-as-setting').checked}});}catch(error){$('#helper-detail').textContent=error.message;}
});
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local' && changes.history) renderHistory(changes.history.newValue || []);
  if(area==='session' && changes.candidate) {renderVideo(changes.candidate.newValue);if(changes.candidate.newValue)notice();}
  if(area==='session' && changes.inspection){setBusy(Boolean(changes.inspection.newValue));if(!changes.inspection.newValue && $('#status').classList.contains('loading'))notice();}
});
window.addEventListener('unload',()=>clearTimeout(pollTimer));
refresh().catch(error=>notice(error.message,'error'));connect();
