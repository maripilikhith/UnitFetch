export function duration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Duration unknown';
  const n = Math.floor(seconds), h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), s = String(n % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2,'0')}:${s}` : `${m}:${s}`;
}
export function bytes(value) {
  if (!Number.isFinite(value) || value <= 0) return '';
  const units = ['B','KB','MB','GB'], i = Math.min(3, Math.floor(Math.log(value)/Math.log(1024)));
  return `${(value/1024**i).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}
export function statusLabel(job) {
  return ({queued:'Queued',downloading:'Downloading',processing:'Combining video and audio',complete:'Saved',cancelled:'Cancelled',failed:'Failed',interrupted:'Interrupted'})[job.status] || 'Preparing';
}
export function dateLabel(value) {
  return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));
}
