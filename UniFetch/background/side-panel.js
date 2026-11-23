import {youtubeVideoUrl} from '../utils/video-context.js';

export function isExtensionUI(sender) {
  if (sender.id !== chrome.runtime.id) return false;
  try { const url = new URL(sender.url), own = new URL(chrome.runtime.getURL('/')); return url.protocol === own.protocol && url.host === own.host && url.pathname === '/popup/popup.html'; }
  catch { return false; }
}

// This must stay synchronous up to sidePanel.open(), preserving the click gesture.
export function openSidePanel(message, sender) {
  const ui = isExtensionUI(sender);
  const youtubePage = sender.id === chrome.runtime.id && sender.frameId === 0 && Number.isInteger(sender.tab?.id) && youtubeVideoUrl(sender.url);
  if (!ui && !youtubePage) throw new Error('Open UniFetch from a YouTube video or its extension popup.');
  if (youtubePage) return chrome.sidePanel.open({tabId:sender.tab.id});
  if (!Number.isInteger(message.windowId) || message.windowId < 0) throw new Error('No browser window is available.');
  return chrome.sidePanel.open({windowId:message.windowId});
}
