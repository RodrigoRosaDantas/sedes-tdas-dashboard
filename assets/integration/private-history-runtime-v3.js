export function startPrivateHistoryRuntime(){
 document.documentElement.dataset.persistenceMode='local-only';
 return {status:'disabled',mode:'local-only',cloudSync:false};
}

if(typeof document!=='undefined')startPrivateHistoryRuntime();
