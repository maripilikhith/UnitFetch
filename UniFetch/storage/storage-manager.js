export const DEFAULT_SETTINGS = {quality:'1080',saveAs:true};
export async function settings() { return {...DEFAULT_SETTINGS,...(await chrome.storage.local.get('settings')).settings}; }
export async function saveSettings(value) {
  const next = {quality:['720','1080','2160','best'].includes(value?.quality)?value.quality:'1080',saveAs:value?.saveAs !== false};
  await chrome.storage.local.set({settings:next});
  return next;
}
