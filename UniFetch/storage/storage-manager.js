export const DEFAULT_SETTINGS = {quality:'1080',saveAs:true,theme:'light'};
export async function settings() { return {...DEFAULT_SETTINGS,...(await chrome.storage.local.get('settings')).settings}; }
export async function saveSettings(value) {
  const current = await settings();
  const next = {...current};
  if (value && Object.hasOwn(value,'quality')) next.quality = ['720','1080','2160','best'].includes(value.quality) ? value.quality : '1080';
  if (value && Object.hasOwn(value,'saveAs')) next.saveAs = value.saveAs !== false;
  if (value && Object.hasOwn(value,'theme')) next.theme = value.theme === 'dark' ? 'dark' : 'light';
  await chrome.storage.local.set({settings:next});
  return next;
}
