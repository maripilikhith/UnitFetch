// Browser-only, lossless track merging. No native process or WebAssembly runtime.
export async function remuxTracks(library, videoBlob, audioBlob, extension, signal) {
  const {Input,BlobSource,MP4,WEBM,Output,BufferTarget,Mp4OutputFormat,WebMOutputFormat,EncodedPacketSink,EncodedVideoPacketSource,EncodedAudioPacketSource}=library;
  if(!['mp4','webm'].includes(extension))throw new Error('Unsupported output container.');
  const inputs=[videoBlob,audioBlob].map(blob=>new Input({formats:[MP4,WEBM],source:new BlobSource(blob)}));
  let output;
  try {
    const tracks=await Promise.all([inputs[0].getPrimaryVideoTrack(),inputs[1].getPrimaryAudioTrack()]);
    if(tracks.some(track=>!track))throw new Error('The download must contain both video and audio.');
    const codecs=await Promise.all(tracks.map(track=>track.getCodec()));
    if(codecs.some(codec=>!codec))throw new Error('This media codec cannot be merged in the browser.');
    const sources=[new EncodedVideoPacketSource(codecs[0]),new EncodedAudioPacketSource(codecs[1])];
    const target=new BufferTarget();
    output=new Output({format:extension==='mp4'?new Mp4OutputFormat():new WebMOutputFormat(),target});
    output.addVideoTrack(sources[0]);output.addAudioTrack(sources[1]);
    await output.start();
    await Promise.all(tracks.map(async(track,index)=>{
      const decoderConfig=await track.getDecoderConfig();let count=0;
      for await(const packet of new EncodedPacketSink(track).packets()) {
        signal?.throwIfAborted();
        await sources[index].add(packet,{decoderConfig});
        if(++count%500===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
      if(!count)throw new Error('An audio or video track was empty.');
      sources[index].close();
    }));
    signal?.throwIfAborted();await output.finalize();
    return new Blob([target.buffer],{type:`video/${extension}`});
  }catch(error){await output?.cancel().catch(()=>{});throw error;}
  finally{for(const input of inputs)input.dispose();}
}
