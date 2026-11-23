import {parseLink} from './url-utils.js';
export function youtubeVideoUrl(input) {
  try { const link = parseLink(input); return link.provider === 'youtube' ? link.url : null; }
  catch { return null; }
}
export function candidateSource(candidate) {
  if (!candidate) return null;
  if (candidate.sourceUrl) return candidate.sourceUrl;
  if (candidate.video?.url) return candidate.video.url;
  if (candidate.video?.provider === 'youtube') return youtubeVideoUrl(`https://youtu.be/${candidate.video.id}`);
  return null;
}
export function chooseFormat(formats, quality = '1080', extension, currentHeight) {
  const available = formats.filter(f => !extension || f.ext === extension);
  if (!available.length) return null;
  if (currentHeight != null) { const same = available.find(f => f.height === currentHeight); if (same) return same; }
  const cap = quality === 'best' ? Infinity : Number(quality);
  const sorted = [...available].sort((a,b) => (b.height || 0) - (a.height || 0) || Number(b.ext === 'mp4') - Number(a.ext === 'mp4'));
  return sorted.find(f => f.height && f.height <= cap) || sorted.at(-1);
}
