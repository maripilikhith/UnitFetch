let port = null;
const pending = new Map();
let listener = () => {};
export function onNativeEvent(fn) { listener = fn; }
function connect() {
  if (port) return port;
  port = chrome.runtime.connectNative('com.unifetch.downloader');
  port.onMessage.addListener(message => {
    if (!message || typeof message !== 'object') return;
    if (message.event) { listener(message); return; }
    const request = pending.get(message.requestId);
    if (!request) return;
    clearTimeout(request.timer); pending.delete(message.requestId);
    if (message.ok) request.resolve(message.data); else request.reject(new Error(message.error || 'The local helper could not finish this request.'));
  });
  port.onDisconnect.addListener(() => {
    const detail = chrome.runtime.lastError?.message || 'Local helper disconnected.';
    port = null;
    for (const request of pending.values()) {clearTimeout(request.timer);request.reject(new Error(`Local helper unavailable. Run the setup script, then check the connection. ${detail}`));}
    pending.clear();
    listener({event:'disconnected'});
  });
  return port;
}
export function nativeRequest(type, payload = {}, timeout = 120000) {
  return new Promise((resolve,reject) => {
    const requestId = crypto.randomUUID();
    const timer = setTimeout(()=>{pending.delete(requestId);reject(new Error('The helper took too long to respond. Check the connection and try again.'));},timeout);
    pending.set(requestId,{resolve,reject,timer});
    try {connect().postMessage({requestId,type,...payload});}
    catch(error) {clearTimeout(timer);pending.delete(requestId);reject(error);}
  });
}
