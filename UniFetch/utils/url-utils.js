const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be']);
export function parseLink(input) {
  if (typeof input !== 'string' || input.length > 8192) throw new Error('Paste a valid video link.');
  let url;
  try { url = new URL(input.trim()); } catch { throw new Error('Paste a complete link beginning with https://.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP or HTTPS link without a username or password.');
  if (YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) {
    let id = null;
    if (url.hostname.endsWith('youtu.be')) id = url.pathname.split('/')[1];
    else if (url.pathname === '/watch') id = url.searchParams.get('v');
    else if (/^\/(shorts|embed|live)\//.test(url.pathname)) id = url.pathname.split('/')[2];
    if (!id || !/^[\w-]{11}$/.test(id)) throw new Error('Use a link to one YouTube video. Playlist and channel links are not supported yet.');
    return { provider: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}`, hostname: 'www.youtube.com' };
  }
  const extension = url.pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || null;
  if (['m3u8', 'mpd'].includes(extension)) return {provider: 'stream', url: url.href, extension, hostname: url.hostname};
  return { provider: 'direct', url: url.href, hostname: url.hostname, extension };
}
export function displayHost(input) { try { return new URL(input).hostname; } catch { return ''; } }
