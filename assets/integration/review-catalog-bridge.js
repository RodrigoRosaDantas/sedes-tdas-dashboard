import {BASE} from '../common.js?v=26.17.0';
import {readModuleState} from './module-store.js?v=2.2.0';
import {loadCurrentCatalog,loadCatalogForQuestion} from './question-catalog-archive.js?v=1.1.0';
import {hydrateBankQuestions,loadMasterQuestionBank} from './question-bank.js?v=1.2.0';

const normalizeUrl=input=>{try{return new URL(typeof input==='string'?input:input?.url||'',location.href).pathname}catch{return''}};
const installCatalogOverride=(catalog,kind,keyProxy=null)=>{
 const originalFetch=globalThis.fetch.bind(globalThis),targetPath=new URL(BASE+'data/integration/question-catalog.json',location.href).pathname,proxyPath=keyProxy?new URL(BASE+keyProxy.alias,location.href).pathname:null;
 globalThis.fetch=(input,init)=>{const pathname=normalizeUrl(input);if(pathname===targetPath)return Promise.resolve(new Response(JSON.stringify(catalog),{status:200,headers:{'content-type':'application/json'}}));if(keyProxy&&pathname===proxyPath)return originalFetch(BASE+keyProxy.actual,init);return originalFetch(input,init)};
 document.documentElement.dataset.reviewCatalog=kind;return catalog;
};
export async function installReviewCatalogBridge(reviewId){
 const id=String(reviewId||'').trim();if(!id)return null;
 const review=readModuleState().reviews.find(item=>item.id===id&&item.status==='pending');if(!review)return null;
 const current=await loadCurrentCatalog();if((current?.questions||[]).some(question=>String(question.id)===String(review.questionId)))return current;
 const historical=await loadCatalogForQuestion(review.questionId);if(historical)return installCatalogOverride(historical,'historical');
 const master=await loadMasterQuestionBank(),indexed=(master.questions||[]).find(item=>String(item.id)===String(review.questionId));if(!indexed)return null;
 const[question]=await hydrateBankQuestions([indexed]);if(!question?.enunciado||!question?.alternativas)return null;
 const actualKeyPath=String(question.sourceKeyPath||'');if(!/^data\/integration\/question-keys\/master\/[a-z0-9._-]+\.json$/i.test(actualKeyPath))return null;
 const proxyKeyPath='data/integration/question-keys/master-review.json';
 const catalog={schemaVersion:'2.2.0',mode:'master-review',catalogId:`master-review:${question.id}`,title:`Revisão · ${question.materialName||'Banco Mestre'}`,description:'Questão histórica recuperada do índice publicado e hidratada sob demanda para revisão.',peId:'BANCO',questionCount:1,suggestedMinutes:2,keyPath:proxyKeyPath,authorizedSource:{type:'master-question-bank',repository:master.snapshot?.source?.repository||null,commit:master.snapshot?.source?.commit||null},questions:[question]};
 return installCatalogOverride(catalog,'master',{alias:proxyKeyPath,actual:actualKeyPath});
}
