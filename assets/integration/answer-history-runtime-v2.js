import {readSessionDraft} from './session-draft.js?v=1.0.0';
import {ensureAnswerHistorySession,recordAnswerChange} from './answer-history.js?v=1.0.0';
const get=()=>{const d=readSessionDraft();return d?.catalogId&&d?.session?.startedAt?{catalogId:d.catalogId,startedAt:d.session.startedAt,questionIds:d.session.questionIds||[],currentIndex:Number(d.session.currentIndex)||0,answers:d.session.answers||{}}:null};
const ensure=()=>{const s=get();if(s)ensureAnswerHistorySession(s)};
document.querySelector('main')?.addEventListener('change',event=>{const input=event.target?.closest?.('input[name="module-answer"]');if(!input?.value)return;const s=get(),questionId=s?.questionIds?.[s.currentIndex];if(s&&questionId)recordAnswerChange({catalogId:s.catalogId,startedAt:s.startedAt,questionId,option:input.value})},true);
window.addEventListener('pageshow',ensure);queueMicrotask(ensure);
