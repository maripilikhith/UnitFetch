const ACTIVE = new Set(['queued','downloading','processing']);
let writeChain = Promise.resolve();
export const isActive = job => ACTIVE.has(job.status);
export async function history() { return (await chrome.storage.local.get('history')).history || []; }
export function updateHistory(job,{onlyActive=false,engineOnly=false}={}) {
  const task = writeChain.then(async () => {
    const list = await history();
    const index = list.findIndex(item => item.id === job.id);
    if(onlyActive&&(index<0||!isActive(list[index])))return false;
    if(engineOnly&&index>=0&&list[index].downloadId!=null)return false;
    if (index >= 0) list[index] = {...list[index],...job}; else list.unshift(job);
    // Keep active work even when the recent-history limit is reached.
    const active = list.filter(isActive), done = list.filter(item=>!isActive(item)).slice(0,100);
    await chrome.storage.local.set({history:[...active,...done].sort((a,b)=>b.createdAt-a.createdAt)});
    return true;
  });
  writeChain = task.catch(error=>console.error('History write failed',error.message));
  return task;
}
export function clearHistory() {
  const task = writeChain.then(async () => chrome.storage.local.set({history:(await history()).filter(isActive)}));
  writeChain = task.catch(error=>console.error('History clear failed',error.message));
  return task;
}
