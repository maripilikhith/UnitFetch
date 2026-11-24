let opening;
let headersReady;
export async function browserRequest(action,payload={}) {
  // Apply only to this extension's anonymous media requests, never to browsing tabs.
  headersReady??=chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[3001],addRules:[{
    id:3001,priority:1,
    condition:{initiatorDomains:[chrome.runtime.id],requestDomains:['youtube.com','youtubei.googleapis.com','googlevideo.com'],resourceTypes:['xmlhttprequest']},
    action:{type:'modifyHeaders',requestHeaders:[{header:'Origin',operation:'set',value:'https://www.youtube.com'},{header:'Referer',operation:'set',value:'https://www.youtube.com/'}]}
  }]}).catch(error=>{headersReady=null;throw error;});
  await headersReady;
  if(!await chrome.offscreen.hasDocument()) {
    opening??=chrome.offscreen.createDocument({url:'engine/offscreen.html',reasons:['BLOBS','IFRAME_SCRIPTING'],justification:'Download and combine video tracks locally, with isolated player processing.'}).finally(()=>{opening=null;});
    await opening;
  }
  const response=await chrome.runtime.sendMessage({target:'engine',action,payload});
  if(!response?.ok)throw new Error(response?.error||'The browser engine could not respond. Reload UniFetch and try again.');
  return response.data;
}
