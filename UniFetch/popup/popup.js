import {parseLink} from '../utils/url-utils.js';
import {youtubeVideoUrl,candidateSource} from '../utils/video-context.js';
import {node,icon,videoCard,jobRow,isActive} from './render.js';

const $=selector=>document.querySelector(selector);
const panelMode=new URLSearchParams(location.search).get('surface')==='panel';
document.body.dataset.surface=panelMode?'panel':'popup';
$('#app-version').textContent=`v${chrome.runtime.getManifest().version}`;
$('#open-panel').hidden=panelMode;
$('#open-panel').disabled=true;

let video=null, jobs=[], prefs={quality:'1080',saveAs:true,theme:'light'};
let busy=false, pollTimer=null, windowId=null, followedTabId=null;
let followPage=true, contextUrl=null, queuedSource=null, lastAttempt=null;

async function request(type,data={}) {
  const result=await chrome.runtime.sendMessage({type,...data});
  if(!result?.ok)throw new Error(result?.error||'UniFetch could not reach its background process. Reload the extension.');
  return result.data;
}
function normalizedInput() {try{return parseLink($('#video-url').value).url;}catch{return null;}}
function updateEmpty() {$('#welcome').hidden=Boolean(video)||busy||jobs.some(isActive)||(!$('#status').hidden&&$('#status').classList.contains('error'));}
function notice(text='',type='') {
  $('#status').textContent=text;$('#status').className=`notice ${type}`;$('#status').hidden=!text;updateEmpty();
}
function setBusy(value) {
  busy=value;
  for(const id of ['#inspect','#video-url','#clear-url','#current-tab'])$(id).disabled=value;
  $('#inspect span').textContent=value?'Finding':'Find';updateEmpty();
}
function showView(name) {
  for(const view of ['fetch','history','settings'])$(`#${view}-view`).hidden=view!==name;
  for(const tab of document.querySelectorAll('[data-view]')) {
    const selected=tab.dataset.view===name;tab.classList.toggle('active',selected);
    if(selected)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');
  }
}
function applyTheme(theme) {
  theme=theme==='dark'?'dark':'light';
  document.documentElement.dataset.theme=theme;
  try{localStorage.setItem('unifetch-theme',theme);}catch{}
  const label=theme==='dark'?'Switch to light mode':'Switch to dark mode';
  $('#theme-toggle').replaceChildren(icon(theme==='dark'?'sun':'moon'));
  $('#theme-toggle').setAttribute('aria-label',label);$('#theme-toggle').title=label;
  $('#theme-setting').value=theme;
}
function updateProvider() {
  let label='YouTube & direct video links';
  if($('#video-url').value.trim()) {
    try{const link=parseLink($('#video-url').value);label=link.provider==='youtube'?'YouTube':link.provider==='stream'?'Segmented stream':'Direct video link';}
    catch{label='Check the link';}
  }
  $('#provider').textContent=label;
  $('#current-context').hidden=!(followPage&&contextUrl&&normalizedInput()===contextUrl);
  $('#auto-label').textContent=followPage?'Auto-detect enabled':'Pasted link';
}
async function startDownload(selectedVideo,formatId) {
  try{await request('DOWNLOAD',{token:selectedVideo.token,formatId});notice('Download started. You can close this popup.');await refresh();}
  catch(error){notice(error.message,'error');}
}
function renderVideo(candidate) {
  video=candidate?.video?{...candidate.video,token:candidate.token}:null;
  const box=$('#video-result');box.replaceChildren();box.hidden=!video;
  if(video)box.append(...videoCard(video,prefs,startDownload));
  updateEmpty();
}
function applyCandidate(candidate) {
  if(!candidate||candidate.expires<Date.now())return;
  if(candidateSource(candidate)!==normalizedInput())return;
  if(candidate.token!==video?.token)renderVideo(candidate);
}
const jobActions={
  async cancel(job){try{await request('CANCEL',{id:job.id});await refresh();}catch(e){showView('fetch');notice(e.message,'error');}},
  async reveal(job){try{await request('SHOW_FILE',{id:job.id});}catch(e){showView('fetch');notice(e.message,'error');}},
  retry(job){followPage=false;$('#video-url').value=`https://www.youtube.com/watch?v=${job.videoId}`;updateProvider();showView('fetch');inspectCurrent();}
};
function renderHistory(next) {
  jobs=next;$('#history-count').textContent=String(jobs.length);
  const active=jobs.filter(isActive);
  $('#active-downloads').replaceChildren(...active.map(job=>jobRow(job,jobActions)));
  const list=$('#history-list');list.replaceChildren(...jobs.map(job=>jobRow(job,jobActions)));
  if(!jobs.length){const empty=node('div','empty');empty.append(node('strong','','No downloads yet'),node('span','','Your saved videos and download progress will appear here.'));list.append(empty);}
  $('#clear-history').disabled=!jobs.some(job=>!isActive(job));updateEmpty();
  clearTimeout(pollTimer);
  if(active.some(job=>job.downloadId!=null))pollTimer=setTimeout(()=>refresh().catch(e=>notice(e.message,'error')),1500);
}
function applySettings(settings) {
  prefs={...prefs,...settings};applyTheme(prefs.theme);
  $('#quality-setting').value=prefs.quality;$('#save-as-setting').checked=prefs.saveAs;
}
async function refresh() {
  const state=await request('GET_STATE');applySettings(state.settings);renderHistory(state.history);applyCandidate(state.candidate);return state;
}
async function connect() {
  $('#connection').className='connection';$('#connection span').textContent='Connecting to your PC…';
  try{
    const data=await request('CONNECT');$('#connection').className='connection ready';$('#connection span').textContent='Local helper connected';
    $('#helper-detail').textContent=`Helper ${data.version} · yt-dlp ${data.tools.ytDlp}. Files save to ${data.downloadDirectory}.`;
  }catch(error){$('#connection').className='connection error';$('#connection span').textContent='Local helper needs setup';$('#helper-detail').textContent=error.message;}
}
async function inspectCurrent({automatic=false}={}) {
  let source;
  try{source=parseLink($('#video-url').value).url;}catch(e){notice(e.message,'error');return;}
  if(busy){if(automatic)queuedSource=source;return;}
  if(automatic&&lastAttempt===source)return;
  lastAttempt=source;setBusy(true);renderVideo(null);notice('Finding available download options…','loading');
  try{
    const result=await request('INSPECT',{url:source});
    if(normalizedInput()===source){renderVideo({token:result.token,video:result});notice();}
  }catch(error){if(normalizedInput()===source)notice(error.message,'error');}
  finally{
    setBusy(false);
    if(queuedSource){const next=queuedSource;queuedSource=null;if(next===normalizedInput()&&next!==source)inspectCurrent({automatic:true});}
  }
}
async function captureTab({manual=false}={}) {
  if(!followPage&&!manual)return false;
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  followedTabId=tab?.id??null;
  const url=youtubeVideoUrl(tab?.url);
  if(url){
    followPage=true;contextUrl=url;
    if(normalizedInput()!==url){$('#video-url').value=url;renderVideo(null);notice();}
    updateProvider();
    if(manual)lastAttempt=null;
    inspectCurrent({automatic:!manual});return true;
  }
  const previousContext=contextUrl;
  contextUrl=null;
  if(panelMode&&followPage&&previousContext&&!manual){$('#video-url').value='';lastAttempt=null;renderVideo(null);notice();}
  updateProvider();
  if(manual){
    if(!tab?.url||!/^https?:/.test(tab.url))throw new Error('Open a video page, then use the toolbar popup or side panel.');
    $('#video-url').value=tab.url;followPage=false;updateProvider();await inspectCurrent();return true;
  }
  return false;
}
async function savePreference(value) {
  try{applySettings(await request('SAVE_SETTINGS',{settings:value}));}
  catch(error){notice(error.message,'error');}
}

$('#link-form').addEventListener('submit',event=>{event.preventDefault();inspectCurrent();});
$('#video-url').addEventListener('input',()=>{
  followPage=false;contextUrl=null;lastAttempt=null;updateProvider();renderVideo(null);notice();
});
$('#clear-url').addEventListener('click',async()=>{
  followPage=false;lastAttempt=null;$('#video-url').value='';updateProvider();renderVideo(null);notice();
  try{await request('CLEAR_PREVIEW');}catch(error){notice(error.message,'error');}$('#video-url').focus();
});
$('#current-tab').addEventListener('click',()=>captureTab({manual:true}).catch(e=>notice(e.message,'error')));
$('#open-panel').addEventListener('click',()=>request('OPEN_SIDE_PANEL',{windowId}).catch(e=>notice(e.message,'error')));
$('#theme-toggle').addEventListener('click',()=>savePreference({theme:prefs.theme==='dark'?'light':'dark'}));
$('#theme-setting').addEventListener('change',()=>savePreference({theme:$('#theme-setting').value}));
$('#quality-setting').addEventListener('change',()=>savePreference({quality:$('#quality-setting').value}));
$('#save-as-setting').addEventListener('change',()=>savePreference({saveAs:$('#save-as-setting').checked}));
$('#expand').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('popup/popup.html')}));
$('.brand').addEventListener('click',event=>{event.preventDefault();showView('fetch');});
for(const tab of document.querySelectorAll('[data-view]'))tab.addEventListener('click',()=>showView(tab.dataset.view));
$('#connection').addEventListener('click',()=>showView('settings'));
$('#reconnect').addEventListener('click',connect);
$('#clear-history').addEventListener('click',async()=>{try{await request('CLEAR_HISTORY');await refresh();}catch(e){showView('fetch');notice(e.message,'error');}});

chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local'&&changes.history)renderHistory(changes.history.newValue||[]);
  if(area==='local'&&changes.settings)applySettings(changes.settings.newValue||{});
  if(area==='session'&&changes.candidate)applyCandidate(changes.candidate.newValue);
  if(area==='session'&&changes.inspectionError){const error=changes.inspectionError.newValue;if(error?.url===normalizedInput())notice(error.message,'error');}
});
chrome.tabs.onUpdated.addListener((tabId,info)=>{
  if(panelMode&&followPage&&tabId===followedTabId&&info.url)captureTab().catch(e=>notice(e.message,'error'));
});
chrome.tabs.onActivated.addListener(info=>{
  if(panelMode&&followPage&&info.windowId===windowId)captureTab().catch(e=>notice(e.message,'error'));
});
window.addEventListener('unload',()=>clearTimeout(pollTimer));

async function initialize() {
  windowId=(await chrome.windows.getCurrent()).id;$('#open-panel').disabled=false;
  const state=await refresh();
  if(!await captureTab()&&!panelMode&&state.candidate?.expires>Date.now()){
    $('#video-url').value=candidateSource(state.candidate)||'';followPage=false;updateProvider();applyCandidate(state.candidate);
  }
}
initialize().catch(e=>notice(e.message,'error'));
connect();
