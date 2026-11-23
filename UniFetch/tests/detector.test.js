import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseLink} from '../utils/url-utils.js';
import {safeFilename} from '../downloader/filename-manager.js';
import {directMetadata} from '../detector/direct-video.js';
import {duration,bytes} from '../utils/format-utils.js';
test('YouTube variants resolve to one canonical video',()=>{
  for(const url of ['https://youtu.be/aqz-KE-bpKQ?t=4','https://www.youtube.com/watch?v=aqz-KE-bpKQ&list=ignored','https://m.youtube.com/shorts/aqz-KE-bpKQ','https://youtube.com/embed/aqz-KE-bpKQ']) assert.equal(parseLink(url).url,'https://www.youtube.com/watch?v=aqz-KE-bpKQ');
});
test('host lookalikes are not treated as YouTube',()=>{
  for(const url of ['https://youtube.com.evil.test/watch?v=aqz-KE-bpKQ','https://evil.test/?next=youtube.com']) assert.equal(parseLink(url).provider,'direct');
});
test('credentials, scripts, blob URLs, and playlists are rejected',()=>{
  for(const url of ['javascript:alert(1)','blob:https://youtube.com/abc','https://user:pass@example.com/file.mp4','https://youtube.com/playlist?list=x','https://youtu.be/short','file:///C:/test.mp4']) assert.throws(()=>parseLink(url));
});
test('direct media and stream manifests are distinguished',()=>{
  assert.equal(directMetadata(parseLink('https://example.com/movie.MP4?token=123')).formats[0].ext,'mp4');
  assert.equal(directMetadata(parseLink('https://example.com/movie.webm')).formats[0].ext,'webm');
  assert.equal(directMetadata(parseLink('https://example.com/video')),null);
  assert.equal(parseLink('https://example.com/playlist.m3u8').provider,'stream');
  assert.equal(parseLink('https://example.com/manifest.mpd').provider,'stream');
});
test('filenames cannot become paths or Windows reserved names',()=>{
  assert.equal(safeFilename('../../CON: bad?','mp4'),'.._.._CON_ bad_.mp4');
  assert.equal(safeFilename('CON','mp4'),'video_CON.mp4');
  assert.equal(safeFilename('movie.mp4','mp4'),'movie.mp4');
});
test('unknown metadata stays unknown',()=>{assert.equal(duration(null),'Duration unknown');assert.equal(bytes(null),'');assert.equal(duration(3661),'1:01:01');});
