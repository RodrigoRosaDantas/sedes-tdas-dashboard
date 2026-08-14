import {BASE} from '../common.js?v=26.17.0';
import {readModuleState} from './module-store.js?v=2.1.0';
import {loadCurrentCatalog,loadCatalogForQuestion} from './question-catalog-archive.js?v=1.1.0';

const normalizeUrl=input=>{
 try{return new URL(typeof input==='string'?input:input?.url||'',location.href).pathname}catch{return''}
};
export async function installReviewCatalogBridge(reviewId){
 const id=String(reviewId||'').trim();if(!id)return null;
 const review=readModuleState().reviews.find(item=>item.id===id&&item.status==='pending');if(!review)return null;
 const current=await loadCurrentCatalog();
 if((current?.questions||[]).some(question=>String(question.id)===String(review.questionId)))return current;
 const historical=await loadCatalogForQuestion(review.questionId);if(!historical)return null;
 const originalFetch=globalThis.fetch.bind(globalThis),targetPath=new URL(BASE+'data/integration/question-catalog.json',location.href).pathname;
 globalThis.fetch=(input,init)=>normalizeUrl(input)===targetPath
  ? Promise.resolve(new Response(JSON.stringify(historical),{status:200,headers:{'content-type':'application/json'}}))
  : originalFetch(input,init);
 document.documentElement.dataset.reviewCatalog='historical';
 return historical;
}
