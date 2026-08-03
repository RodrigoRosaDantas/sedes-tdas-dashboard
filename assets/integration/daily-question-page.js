import {BASE, escapeHTML, loadJSON, setLoadingError} from '../common.js?v=24.1';
import {findDailyExecution, loadDailyExecution, normalizePe, peDetailPath, selectedPe} from './daily-execution.js?v=1.0.0';
const waitForPlayer=()=>new Promise((resolve,reject)=>{let attempts=0;const tick=()=>{const main=document.querySelector('main'),heading=main?.querySelector('.hero h1')?.textContent.trim();if(heading&&heading!=='Carregando…')return resolve({main,heading});if(attempts++>120)return reject(new Error('A página de questões não ficou pronta.'));setTimeout(tick,40)};tick()});
const optionalCatalog=()=>fetch(BASE+'data/integration/question-catalog.json',{cache:'no-store'}).then(response=>response.ok?response.json():null).catch(()=>null);
try{
 const[{main,heading},today,contract,catalog]=await Promise.all([waitForPlayer(),loadJSON('data/today.json'),loadDailyExecution(),optionalCatalog()]);
 const pe=selectedPe(today.current.pe),item=findDailyExecution(contract,pe);if(!item)throw new Error(`Página de questões não encontrada para ${pe||'o PE solicitado'}.`);
 const incorporated=Array.isArray(catalog?.questions)&&catalog.questions.length>0&&normalizePe(catalog.peId)===pe;
 if(incorporated&&heading!=='Nenhuma questão disponível'){
  document.documentElement.dataset.dailyQuestionContext='player-active';
  const actions=main.querySelector('.hero-actions');
  if(actions&&!actions.querySelector('[data-question-source]'))actions.insertAdjacentHTML('beforeend',`<a class="btn" data-question-source href="${item.questionsUrl}" target="_blank" rel="noopener">Conferir fonte no Notion ↗</a>`);
 }else{
  main.innerHTML=`<section class="hero"><span class="kicker">Execução diária · etapa 2</span><h1>Questões do dia — ${escapeHTML(pe)}</h1><p>O player incorpora somente o PE vigente após a sincronização e validação da página filha oficial.</p><div class="tags"><span class="tag">Semana ${item.week}</span><span class="tag">Página oficial do dia</span><span class="tag">Correção separada</span></div><div class="hero-actions"><a class="btn primary" href="${item.questionsUrl}" target="_blank" rel="noopener">Abrir questões no Notion ↗</a><a class="btn" href="${BASE}estudar/?pe=${encodeURIComponent(pe)}">Voltar ao material</a><a class="btn" href="${peDetailPath(pe)}">Ver detalhes do PE</a></div></section><section class="section"><div class="grid two"><article class="card panel"><small>Página exclusiva</small><h2>Somente questões</h2><p>O material teórico permanece separado. Comentários e fundamentos não são incorporados ao catálogo público.</p></article><article class="card panel"><small>Player local</small><h2>${normalizePe(catalog?.peId)&&normalizePe(catalog.peId)!==pe?'Outro PE selecionado':'Sincronização pendente'}</h2><p>${normalizePe(catalog?.peId)&&normalizePe(catalog.peId)!==pe?`O catálogo interno disponível pertence ao ${escapeHTML(normalizePe(catalog.peId))}.`:'O catálogo será ativado automaticamente quando a sincronização do dia concluir.'}</p></article></div></section><footer class="footer"><span>Questões diárias · ${escapeHTML(pe)}</span><span>Snapshot <span data-snapshot></span></span></footer>`;
  document.documentElement.dataset.dailyQuestionContext=pe;
 }
}catch(error){setLoadingError(error)}
