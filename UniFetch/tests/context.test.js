import {test} from 'node:test';
import assert from 'node:assert/strict';
import {youtubeVideoUrl,candidateSource,chooseFormat} from '../utils/video-context.js';
import {isExtensionUI,openSidePanel} from '../background/side-panel.js';
import {settings,saveSettings} from '../storage/storage-manager.js';

test('current-tab detection only accepts actual YouTube video links',()=>{
  assert.equal(youtubeVideoUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=4'),'https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  for(const url of ['https://www.youtube.com/','https://www.youtube.com/playlist?list=x','https://youtube.com.evil.test/watch?v=aqz-KE-bpKQ',undefined])assert.equal(youtubeVideoUrl(url),null);
});
test('v1 cached previews can still be matched to their video',()=>{
  assert.equal(candidateSource({video:{provider:'youtube',id:'aqz-KE-bpKQ'}}),'https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  assert.equal(candidateSource({video:{provider:'direct',url:'https://example.com/v.mp4'}}),'https://example.com/v.mp4');
});
test('format changes preserve resolution and respect preferred quality',()=>{
  const formats=[{id:'4k',ext:'mp4',height:2160},{id:'1080',ext:'mp4',height:1080},{id:'webm',ext:'webm',height:1080},{id:'720',ext:'mp4',height:720}];
  assert.equal(chooseFormat(formats,'1080').id,'1080');
  assert.equal(chooseFormat(formats,'best').id,'4k');
  assert.equal(chooseFormat(formats,'720','webm',1080).id,'webm');
  assert.equal(chooseFormat([{id:'direct',ext:'mp4',height:null}]).id,'direct');
});
test('only the exact extension UI or top-level YouTube page may open the panel',async()=>{
  const opened=[];
  globalThis.chrome={runtime:{id:'unifetch',getURL:path=>'chrome-extension://unifetch'+(path.startsWith('/')?path:'/'+path)},sidePanel:{open:options=>{opened.push(options);return Promise.resolve();}}};
  assert.equal(isExtensionUI({id:'unifetch',url:'chrome-extension://unifetch/popup/popup.html?surface=panel'}),true);
  assert.equal(isExtensionUI({id:'unifetch',url:'chrome-extension://impostor/popup/popup.html'}),false);
  assert.throws(()=>openSidePanel({}, {id:'unifetch',url:'https://evil.test/',tab:{id:3},frameId:0}));
  assert.throws(()=>openSidePanel({}, {id:'unifetch',url:'https://www.youtube.com/watch?v=aqz-KE-bpKQ',tab:{id:3},frameId:2}));
  await openSidePanel({}, {id:'unifetch',url:'https://www.youtube.com/watch?v=aqz-KE-bpKQ',tab:{id:3},frameId:0});
  assert.deepEqual(opened,[{tabId:3}]);
});
test('theme defaults migrate old preferences and partial changes preserve them',async()=>{
  const state={settings:{quality:'720',saveAs:false}};
  globalThis.chrome={storage:{local:{get:async()=>structuredClone(state),set:async value=>Object.assign(state,value)}}};
  assert.equal((await settings()).theme,'light');
  assert.deepEqual(await saveSettings({theme:'dark'}),{quality:'720',saveAs:false,theme:'dark'});
  assert.equal((await saveSettings({theme:'unsafe'})).theme,'light');
});
