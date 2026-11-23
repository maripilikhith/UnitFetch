export function streamNotice(extension) {
  return `${extension === 'm3u8' ? 'HLS playlist' : 'DASH manifest'} detected. Standalone segmented-stream downloads are not supported in this version. Paste the original supported video page instead.`;
}
