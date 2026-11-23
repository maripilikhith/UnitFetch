export function safeFilename(title, extension = 'mp4') {
  let name = String(title || 'video').normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/g,'').slice(0,150);
  if (!name || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name)) name = `video_${name || 'download'}`;
  const ext = /^(mp4|webm|m4v|mov)$/i.test(extension) ? extension.toLowerCase() : 'mp4';
  return name.toLowerCase().endsWith(`.${ext}`) ? name : `${name}.${ext}`;
}
