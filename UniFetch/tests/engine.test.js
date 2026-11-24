import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as library from '../vendor/engine.js';
import {remuxTracks} from '../engine/remux.js';
import {allowedEngineUrl,formatOptions,MAX_BYTES} from '../engine/policy.js';
test('engine network policy rejects credentials, lookalikes, non-HTTPS and arbitrary hosts',()=>{
  for(const url of ['https://www.youtube.com/youtubei/v1/player','https://r1---sn-test.googlevideo.com/videoplayback'])assert(allowedEngineUrl(url));
  for(const url of ['http://www.youtube.com/','https://youtube.com.evil.test/','https://googlevideo.com.evil.test/','https://user:pass@www.youtube.com/','https://www.youtube.com:8443/','https://127.0.0.1/','file:///x'])assert(!allowedEngineUrl(url));
});
test('format pairing keeps compatible audio, prefers stereo and excludes oversized tracks',()=>{
  const audio={itag:140,mimeType:'audio/mp4',hasAudio:true,isOriginal:true,numChannels:2,contentLength:1000,bitrate:128000};
  const video={itag:135,mimeType:'video/mp4; codecs="avc1"',hasVideo:true,height:480,contentLength:10000};
  const result=formatOptions([audio,{...audio,itag:258,numChannels:6,bitrate:400000},video,{...video,itag:137,height:1080,contentLength:MAX_BYTES}]);
  assert.equal(result.length,1);assert.equal(result[0].id,'135:140');assert.equal(result[0].filesize,11000);
  assert.deepEqual(formatOptions([video]),[]);
  assert.deepEqual(formatOptions([video,{...audio,mimeType:'audio/webm'}]),[]);
});
for(const ext of ['mp4','webm'])test(`lossless ${ext} merging produces a complete video and audio track`,async()=>{
  const fixture=new Blob([await readFile(new URL(`./fixtures/av.${ext}`,import.meta.url))]);
  const blob=await remuxTracks(library,fixture,fixture,ext,new AbortController().signal);
  const input=new library.Input({formats:[library.MP4,library.WEBM],source:new library.BlobSource(blob)});
  try {
    const tracks=await input.getTracks();assert.equal(tracks.length,2);
    assert(await input.getPrimaryVideoTrack());assert(await input.getPrimaryAudioTrack());
    for(const track of tracks)assert((await track.computeDuration())>=2.9);
  }finally{input.dispose();}
  const controller=new AbortController();controller.abort(new Error('Cancelled by test'));
  await assert.rejects(remuxTracks(library,fixture,fixture,ext,controller.signal),/Cancelled/);
});
