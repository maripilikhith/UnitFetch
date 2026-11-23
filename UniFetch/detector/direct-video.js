export function directMetadata(link) {
  const mime = {mp4:'video/mp4',webm:'video/webm',m4v:'video/mp4',mov:'video/quicktime'}[link.extension];
  if (!mime) return null;
  let title;
  try { title = decodeURIComponent(new URL(link.url).pathname.split('/').pop()); } catch { title = 'video'; }
  return { provider:'direct', url:link.url, title, hostname:link.hostname, duration:null, thumbnail:null, formats:[{id:'direct',label:`${link.extension.toUpperCase()} · original file`,ext:link.extension,height:null,filesize:null}], notice:'Direct file link detected. The server decides whether the file can be downloaded.' };
}
