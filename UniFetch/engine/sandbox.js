// This page has an opaque sandbox origin, no extension APIs and no network access.
addEventListener('message',async event=>{
  if(event.source!==parent||event.data?.type!=='EVALUATE_PLAYER')return;
  const {id,code}=event.data;
  if(typeof id!=='string'||typeof code!=='string'||code.length>4000000)return;
  try {
    const value=await new Function(code)();
    const result={};
    for(const key of ['sig','n','sp'])if(typeof value?.[key]==='string'&&value[key].length<10000)result[key]=value[key];
    parent.postMessage({id,result},'*');
  }catch{parent.postMessage({id,error:'YouTube player processing failed. Try again after updating UniFetch.'},'*');}
});
