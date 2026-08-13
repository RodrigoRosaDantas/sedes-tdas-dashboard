import {readModuleState} from './module-store.js?v=2.1.0';
import {buildErrorBookExport} from './error-book-export.js?v=1.0.0';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function loadCatalog(){try{const response=await fetch('/sedes-tdas-dashboard/data/integration/question-catalog.json',{cache:'no-store'});return response.ok?await response.json():null}catch{return null}}
function download(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),0)}
function questionIdOf(error){return String(error.questionId||error.id?.match(/(PE\d+-Q\d+)$/i)?.[1]||'')}
function exportOccurrence(error,question,catalog){return buildErrorBookExport([{attemptId:error.attemptId,peId:error.peId,occurredAt:new Date(error.createdAt).toISOString(),question:{...question,selected:error.selected,correctAnswer:error.correctAnswer,correct:false,confidence:error.confidence||'secure',marked:error.marked===true,classification:error.classification,activeMs:error.telemetry?.activeMs||0,visits:error.telemetry?.visits||0,answerChanges:error.telemetry?.answerChanges||0,firstAnswer:error.telemetry?.firstAnswer||null,lastAnswer:error.telemetry?.lastAnswer||error.selected},source:catalog?.authorizedSource||null}])}
async function mount(){
 const state=readModuleState(),catalog=await loadCatalog(),byId=new Map((catalog?.questions||[]).map(question=>[String(question.id),question])),main=document.querySelector('main');if(!main)return;
 const cards=[...main.querySelectorAll('section .grid.two article.card.panel')];
 for(const [index,error] of (state.errors||[]).entries()){
  const card=cards[index],question=byId.get(questionIdOf(error));if(!card||!question)continue;
  const actions=document.createElement('div');actions.className='hero-actions';actions.innerHTML='<button class="btn" type="button" data-view-full>Ver questão</button><button class="btn" type="button" data-export-full>Exportar para ChatGPT</button>';
  const detail=document.createElement('div');detail.hidden=true;detail.innerHTML=`<hr><h4>Questão completa</h4><p>${esc(question.enunciado)}</p><ol>${Object.entries(question.alternativas||{}).map(([key,value])=>`<li><strong>${key})</strong> ${esc(value)}</li>`).join('')}</ol><p>Sua resposta: <strong>${esc(error.selected)}</strong> · Gabarito: <strong>${esc(error.correctAnswer)}</strong> · Confiança: <strong>${esc(error.confidence||'secure')}</strong></p>`;
  card.append(actions,detail);
  actions.querySelector('[data-view-full]').addEventListener('click',()=>{detail.hidden=!detail.hidden});
  actions.querySelector('[data-export-full]').addEventListener('click',()=>download(exportOccurrence(error,question,catalog),`tdas-${error.peId||'erro'}-q${error.numeroOriginal||index+1}.json`));
 }
}
const observer=new MutationObserver(()=>{if(document.querySelector('main h1')?.textContent?.includes('Caderno de erros')){observer.disconnect();mount().catch(console.error)}});
observer.observe(document.querySelector('main')||document.body,{subtree:true,childList:true});
setTimeout(()=>{observer.disconnect();mount().catch(console.error)},1500);
