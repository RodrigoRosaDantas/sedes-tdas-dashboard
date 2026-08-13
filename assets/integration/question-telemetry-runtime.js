import {BASE} from '../common.js?v=26.1';
import {readModuleState} from './module-store.js?v=2.1.0';
import {readSessionDraft} from './session-draft.js?v=1.0.0';
import {finalizeTelemetrySession,readTelemetryState,setTelemetryActive,startTelemetrySession,syncTelemetrySession} from './question-telemetry.js?v=1.0.0';

const params=new URLSearchParams(location.search),reviewId=params.get('review'),main=document.querySelector('main');
let catalog=null,reviewStartedAt=null;
const foreground=()=>document.visibilityState!=='hidden'&&document.hasFocus();
const checkedAnswer=()=>document.querySelector('input[name="module-answer"]:checked')?.value||null;

async function loadCatalog(){
 if(catalog)return catalog;
 const response=await fetch(BASE+'data/integration/question-catalog.json',{cache:'no-store'});
 if(!response.ok)throw new Error(`Telemetria: catálogo indisponível (${response.status}).`);
 catalog=await response.json();return catalog;
}
function activateAccordingToPage(){setTelemetryActive(foreground(),undefined,Date.now())}
function studySnapshot(){
 const draft=readSessionDraft();if(!draft)return null;
 return{catalogId:draft.catalogId,startedAt:draft.session.startedAt,questionIds:draft.session.questionIds,currentIndex:draft.session.currentIndex,answers:draft.session.answers};
}
async function reviewSnapshot({start=false}={}){
 const currentCatalog=await loadCatalog(),review=readModuleState().reviews.find(item=>item.id===reviewId);if(!review)return null;
 const catalogId=`${currentCatalog.catalogId}:review:${reviewId}`;
 if(start)reviewStartedAt=Date.now();
 if(!reviewStartedAt){const active=readTelemetryState().active;if(active?.catalogId===catalogId)reviewStartedAt=active.startedAt;else return null;}
 const answer=checkedAnswer();return{catalogId,startedAt:reviewStartedAt,questionIds:[review.questionId],currentIndex:0,answers:answer?{[review.questionId]:answer}:{}};
}
async function syncCurrent({startReview=false}={}){
 try{
  const snapshot=reviewId?await reviewSnapshot({start:startReview}):studySnapshot();if(!snapshot)return;
  const active=readTelemetryState().active;
  if(startReview||!active||active.catalogId!==snapshot.catalogId||Math.abs(Number(active.startedAt)-Number(snapshot.startedAt))>2500)startTelemetrySession(snapshot,undefined,Date.now());
  else syncTelemetrySession(snapshot,undefined,Date.now());
  activateAccordingToPage();
 }catch(error){console.warn('Telemetria local indisponível:',error)}
}
async function finalizeCurrent(){
 try{
  const snapshot=reviewId?await reviewSnapshot():studySnapshot();if(!snapshot)return;
  finalizeTelemetrySession({catalogId:snapshot.catalogId,startedAt:snapshot.startedAt},undefined,Date.now());
 }catch(error){console.warn('Telemetria local não finalizada:',error)}
}
function pause(){try{setTelemetryActive(false,undefined,Date.now())}catch(error){console.warn('Telemetria local não pausada:',error)}}

main?.addEventListener('change',()=>queueMicrotask(()=>syncCurrent()));
main?.addEventListener('click',event=>{
 const finish=event.target.closest('[data-module-finish]'),start=event.target.closest('[data-module-start]'),resume=event.target.closest('[data-module-resume]');
 if(finish){queueMicrotask(()=>finalizeCurrent());return}
 if(start){queueMicrotask(()=>syncCurrent({startReview:!!reviewId}));return}
 if(resume){queueMicrotask(()=>syncCurrent());return}
 queueMicrotask(()=>syncCurrent());
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')pause();else queueMicrotask(()=>syncCurrent())});
window.addEventListener('blur',pause);
window.addEventListener('focus',()=>queueMicrotask(()=>syncCurrent()));
window.addEventListener('pagehide',pause);
queueMicrotask(()=>syncCurrent());
