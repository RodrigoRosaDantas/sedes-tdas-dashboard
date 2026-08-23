const LOCAL_ONLY_RESULT=Object.freeze({status:'disabled',mode:'local-only',provider:null,uploaded:0,failed:0,remote:0,drafts:0,states:0,restoredDraft:false,cloudSync:false});

export async function syncPrivateHistory(){
 return LOCAL_ONLY_RESULT;
}
