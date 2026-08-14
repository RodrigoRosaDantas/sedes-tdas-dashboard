import {BASE,escapeHTML,loadJSON,setupShell,setLoadingError} from '../common.js?v=26.17.0';
import {canFinish,createSession,evaluateSession,formatElapsed,moveToQuestion,selectAnswer,sessionProgress} from './player-core.js?v=1.0.0';
import {saveCompletedAttempt} from './module-store.js?v=2.1.0';
import {clearSessionDraft,readSessionDraft,writeSessionDraft} from './session-draft.js?v=1.0.0';
import {bankFacets,buildBankCatalog,filterBankQuestions,loadMergedBankKey,loadQuestionBank,rebuildBankCatalogFromDraft,selectBankQuestions} from './question-bank.js?v=1.1.0';

const main=document.querySelector('main');
const state={catalogs:[],allQuestions:[],filtered:[],catalog:null,session:null,responseMeta:{},timer:null,draft:null};
const FILTERS=[
 {key:'pe',selector:'[data-bank-pe]',facet:'pes',empty:'Todas as origens'},
 {key:'materia',selector:'[data-bank-materia]',facet:'materias',empty:'Todas as matérias'},
 {key:'assunto',selector:'[data-bank-assunto]',facet:'assuntos',empty:'Todos os assuntos'},
 {key:'material',selector:'[data-bank-material]',facet:'materiais',empty:'Todos os materiais'},
 {key:'banca',selector:'[data-bank-banca]',facet:'bancas',empty:'Todas as bancas/fontes'},
 {key:'tipo',selector:'[data-bank-tipo]',facet:'tipos',empty:'Todos os tipos'}
];
const metaFor=id=>({confidence:'secure',marked:false,issue:'none',...(state.responseMeta[id]||{})});
const stopTimer=()=>{if(state.timer)clearInterval(state.timer);state.timer=null};
const updateTimer=()=>{const node=document.querySelector('[data-module-timer]');if(node&&state.session)node.textContent=formatElapsed(Date.now()-state.session.startedAt)};
const startTimer=()=>{stopTimer();updateTimer();state.timer=setInterval(updateTimer,1000)};
const persistDraft=()=>{if(!state.catalog||!state.session)return;state.draft=writeSessionDraft({catalogId:state.catalog.catalogId,peId:'BANCO',session:state.session,responseMeta:state.responseMeta})};
const option=(value,label,selected='')=>`<option value="${escapeHTML(value)}" ${value===selected?'selected':''}>${escapeHTML(label)}</option>`;

function renderBuilder(){
 const draft=state.draft?.catalogId?.startsWith('tdas-bank-')?state.draft:null;
 main.innerHTML=`<section class="hero bank-hero"><div><span class="kicker">Questões · modo Banco</span><h1>Monte sua bateria antes de começar</h1><p>Filtre o acervo autorizado, veja quantas questões existem e escolha exatamente quantas quer resolver. A correção continua cega até o fim.</p></div><div class="hero-actions"><a class="btn" href="${BASE}resolver/">Questões do PE atual</a>${draft?`<button class="btn primary" data-bank-resume>Continuar questão ${draft.session.currentIndex+1} de ${draft.session.questionIds.length}</button>`:''}</div></section>
 <section class="section bank-builder"><div class="bank-builder-grid">
  <article class="card panel bank-filter-card"><div class="section-head"><div><span class="kicker">1 · Escolha o recorte</span><h2>Filtros encadeados</h2></div><strong data-bank-total>${state.allQuestions.length} no acervo</strong></div>
   <div class="bank-filter-grid"><label>Origem<select data-bank-pe></select></label><label>Matéria<select data-bank-materia></select></label><label>Assunto<select data-bank-assunto></select></label><label>Material / simulado<select data-bank-material></select></label><label>Banca / fonte<select data-bank-banca></select></label><label>Tipo<select data-bank-tipo></select></label><label class="bank-search-wide">Pesquisar<input data-bank-query type="search" autocomplete="off" placeholder="Código, palavra do enunciado, assunto, material ou órgão"></label></div>
   <p class="bank-note">Os filtros conversam entre si: ao escolher uma matéria, os assuntos, materiais e fontes incompatíveis desaparecem automaticamente. Nenhuma classificação é inferida artificialmente.</p>
  </article>
  <article class="card panel bank-size-card"><span class="kicker">2 · Defina a bateria</span><h2><span data-bank-available>0</span> questões disponíveis</h2><label>Quantidade<input data-bank-count type="number" min="1" value="10" inputmode="numeric"></label><div class="bank-size-presets" aria-label="Atalhos de quantidade"><button class="btn" type="button" data-bank-size="10">10</button><button class="btn" type="button" data-bank-size="20">20</button><button class="btn" type="button" data-bank-size="30">30</button><button class="btn" type="button" data-bank-size="50">50</button><button class="btn" type="button" data-bank-size="all">Todas</button></div><label class="bank-random"><input data-bank-random type="checkbox"> Embaralhar a ordem desta bateria</label><div class="bank-actions"><button class="btn primary" data-bank-start>Iniciar bateria</button><button class="btn" data-bank-clear>Limpar filtros</button></div><p class="bank-note" data-bank-size-note></p></article>
 </div><article class="card panel bank-preview-card"><div class="section-head"><div><span class="kicker">Prévia</span><h2>O que entrou no filtro</h2></div><span class="stamp" data-bank-summary></span></div><div data-bank-preview class="bank-preview"></div></article></section>`;
 updateBuilder({syncOptions:true});
}
function readFilters(){return{pe:document.querySelector('[data-bank-pe]')?.value||'',materia:document.querySelector('[data-bank-materia]')?.value||'',assunto:document.querySelector('[data-bank-assunto]')?.value||'',material:document.querySelector('[data-bank-material]')?.value||'',banca:document.querySelector('[data-bank-banca]')?.value||'',tipo:document.querySelector('[data-bank-tipo]')?.value||'',query:document.querySelector('[data-bank-query]')?.value||''}}
function facetValues(filters,definition){const scoped={...filters,[definition.key]:''};return bankFacets(filterBankQuestions(state.allQuestions,scoped))[definition.facet]||[]}
function syncFilterOptions(filters,changedKey=''){
 const next={...filters};
 for(let pass=0;pass<2;pass++){
  for(const definition of FILTERS){if(definition.key===changedKey)continue;const values=facetValues(next,definition);if(next[definition.key]&&!values.includes(next[definition.key]))next[definition.key]='';}
 }
 for(const definition of FILTERS){
  const node=document.querySelector(definition.selector);if(!node)continue;const values=facetValues(next,definition),selected=next[definition.key];node.innerHTML=option('',definition.empty,selected)+values.map(value=>option(value,value,selected)).join('');node.value=selected;
 }
 return next;
}
function updateBuilder({syncOptions=false,changedKey=''}={}){
 let filters=readFilters();if(syncOptions)filters=syncFilterOptions(filters,changedKey);
 state.filtered=filterBankQuestions(state.allQuestions,filters);const count=document.querySelector('[data-bank-count]'),available=state.filtered.length;
 if(count){count.max=String(Math.max(1,available));const current=Math.max(1,Math.floor(Number(count.value)||10));count.value=String(available?Math.min(current,available):1);count.disabled=!available;}
 const start=document.querySelector('[data-bank-start]');if(start)start.disabled=!available;
 const availableNode=document.querySelector('[data-bank-available]');if(availableNode)availableNode.textContent=String(available);
 const totalNode=document.querySelector('[data-bank-total]');if(totalNode)totalNode.textContent=`${state.allQuestions.length} no acervo`;
 const summary=document.querySelector('[data-bank-summary]');if(summary)summary.textContent=available?`${Math.min(8,available)} de ${available} na prévia`:'Nenhum resultado';
 const note=document.querySelector('[data-bank-size-note]');if(note)note.textContent=available>100?'Você pode selecionar o lote inteiro; para treino diário, baterias menores deixam correção e revisão mais manejáveis.':'';
 const preview=document.querySelector('[data-bank-preview]');if(preview)preview.innerHTML=available?state.filtered.slice(0,8).map((question,index)=>`<div class="bank-preview-item"><span>${index+1}</span><div><strong>${escapeHTML(question.sourcePe||'—')} · ${escapeHTML(question.materia||question.assunto||'Questão')}</strong>${question.materialName?`<small>${escapeHTML(question.materialName)}${question.banca?` · ${escapeHTML(question.banca)}`:''}</small>`:''}<p>${escapeHTML(question.enunciado)}</p></div></div>`).join(''):'<div class="empty">Nenhuma questão corresponde a esses filtros.</div>';
}
function setPreset(value){const input=document.querySelector('[data-bank-count]'),available=state.filtered.length;if(!input||!available)return;input.value=value==='all'?String(available):String(Math.min(available,Math.max(1,Number(value)||10)));updateBuilder()}
function startBankSession(){
 const count=Math.floor(Number(document.querySelector('[data-bank-count]')?.value)||0),random=document.querySelector('[data-bank-random]')?.checked===true,selected=selectBankQuestions(state.filtered,count,{random,seed:Date.now()});
 state.catalog=buildBankCatalog(selected);clearSessionDraft();state.session=createSession({id:state.catalog.catalogId,questoes:state.catalog.questions},Date.now());state.responseMeta={};persistDraft();startTimer();renderQuestion();
}
function resumeBankSession(){
 const draft=readSessionDraft(),catalog=rebuildBankCatalogFromDraft(draft,state.allQuestions);if(!catalog){clearSessionDraft();state.draft=null;renderBuilder();return;}
 state.catalog=catalog;state.session=draft.session;state.responseMeta={...draft.responseMeta};state.draft=draft;startTimer();renderQuestion();
}
function renderQuestion(){
 const progress=sessionProgress(state.session),question=state.catalog.questions[state.session.currentIndex],selected=state.session.answers[question.id]||'',meta=metaFor(question.id),last=state.session.currentIndex===progress.total-1;
 main.innerHTML=`<section class="hero pilot-shell bank-session-head"><div class="pilot-toolbar"><div class="pilot-progress"><div><strong>Questão ${state.session.currentIndex+1} de ${progress.total}</strong> · ${progress.answered} respondidas</div><div class="pilot-progress-track"><div class="pilot-progress-fill" style="width:${progress.percent}%"></div></div></div><strong class="pilot-timer" data-module-timer>${formatElapsed(Date.now()-state.session.startedAt)}</strong></div></section><section class="section pilot-shell"><article class="card panel pilot-question"><div class="bank-question-origin"><span>${escapeHTML(question.sourcePe||'Banco')}</span><span>${escapeHTML(question.materia||question.assunto||'Questão')}</span>${question.materialName?`<span>${escapeHTML(question.materialName)}</span>`:''}</div><h1>${escapeHTML(question.enunciado)}</h1>${question.texto_base?`<blockquote class="pilot-text">${escapeHTML(question.texto_base)}</blockquote>`:''}<fieldset class="pilot-options"><legend class="skip">Escolha uma alternativa</legend>${['A','B','C','D','E'].filter(letter=>question.alternativas?.[letter]).map(letter=>`<label class="pilot-option"><input type="radio" name="module-answer" value="${letter}" ${selected===letter?'checked':''}><span><strong>${letter})</strong> ${escapeHTML(question.alternativas[letter])}</span></label>`).join('')}</fieldset><fieldset class="pilot-meta"><legend><strong>Como você chegou à resposta?</strong></legend><div class="pilot-meta-grid"><label><input type="radio" name="module-confidence" value="secure" ${meta.confidence==='secure'?'checked':''}> Sei</label><label><input type="radio" name="module-confidence" value="doubt" ${meta.confidence==='doubt'?'checked':''}> Tenho dúvida</label><label><input type="radio" name="module-confidence" value="guess" ${meta.confidence==='guess'?'checked':''}> Chute</label></div><label><input type="checkbox" data-module-marked ${meta.marked?'checked':''}> Marcar para revisão</label><label>Ressalva editorial<select data-module-issue><option value="none" ${meta.issue==='none'?'selected':''}>Nenhuma</option><option value="annulment_pending" ${meta.issue==='annulment_pending'?'selected':''}>Possível anulação</option><option value="source_error" ${meta.issue==='source_error'?'selected':''}>Possível erro da fonte</option></select></label></fieldset></article><article class="card panel bank-map-card"><div class="section-head"><div><h2>Mapa da bateria</h2><p>A última questão encerra a navegação; não há retorno automático ao início.</p></div><span class="stamp">${progress.remaining} pendentes</span></div><div class="pilot-map">${state.catalog.questions.map((item,index)=>`<button class="btn ${state.session.answers[item.id]?'answered':''} ${index===state.session.currentIndex?'current':''}" data-module-index="${index}">${index+1}</button>`).join('')}</div></article><div class="pilot-actions"><button class="btn" data-module-prev ${state.session.currentIndex===0?'disabled':''}>← Anterior</button><button class="btn" data-bank-exit>Voltar ao banco</button>${last?`<button class="btn primary" data-module-finish ${canFinish(state.session)?'':'disabled'}>Finalizar (${progress.remaining} pendentes)</button>`:'<button class="btn primary" data-module-next>Próxima →</button>'}</div></section>`;updateTimer();
}
async function finishSession(){
 if(!canFinish(state.session))return;const button=document.querySelector('[data-module-finish]');if(button){button.disabled=true;button.textContent='Corrigindo…';}
 const key=await loadMergedBankKey(state.catalog),evaluation=evaluateSession(state.session,key,Date.now());stopTimer();const saved=saveCompletedAttempt({catalog:state.catalog,evaluation,responseMeta:state.responseMeta,mode:'study'});clearSessionDraft();state.draft=null;
 main.innerHTML=`<section class="hero pilot-result"><span class="kicker">Bateria concluída</span><h1>${evaluation.correct}/${evaluation.total} acertos · ${evaluation.percent.toFixed(0)}%</h1><p>A tentativa foi salva neste dispositivo. ${saved.state.errors.length} erros e ${saved.state.reviews.filter(item=>item.status==='pending').length} revisões estão registrados no histórico local.</p><div class="hero-actions"><a class="btn primary" href="${BASE}resolver/?modo=banco">Montar nova bateria</a><a class="btn" href="${BASE}caderno-erros/">Abrir caderno de erros</a><a class="btn" href="${BASE}desempenho/">Ver desempenho</a></div></section>`;
}
main.addEventListener('input',event=>{if(event.target.matches('[data-bank-query],[data-bank-count]'))updateBuilder()});
main.addEventListener('change',event=>{
 const definition=FILTERS.find(item=>event.target.matches(item.selector));if(definition){updateBuilder({syncOptions:true,changedKey:definition.key});return}
 if(event.target.matches('[data-bank-random]'))return;
 if(!state.session)return;const questionId=state.session.questionIds[state.session.currentIndex];
 if(event.target.matches('input[name="module-answer"]'))state.session=selectAnswer(state.session,questionId,event.target.value,Date.now());
 else if(event.target.matches('input[name="module-confidence"]'))state.responseMeta[questionId]={...metaFor(questionId),confidence:event.target.value};
 else if(event.target.matches('[data-module-marked]'))state.responseMeta[questionId]={...metaFor(questionId),marked:event.target.checked};
 else if(event.target.matches('[data-module-issue]'))state.responseMeta[questionId]={...metaFor(questionId),issue:event.target.value};else return;
 persistDraft();renderQuestion();
});
main.addEventListener('click',event=>{
 const preset=event.target.closest('[data-bank-size]');if(preset){setPreset(preset.dataset.bankSize);return}
 if(event.target.closest('[data-bank-start]')){startBankSession();return}
 if(event.target.closest('[data-bank-resume]')){resumeBankSession();return}
 if(event.target.closest('[data-bank-clear]')){FILTERS.forEach(item=>{const node=document.querySelector(item.selector);if(node)node.value=''});const query=document.querySelector('[data-bank-query]');if(query)query.value='';updateBuilder({syncOptions:true});return}
 if(event.target.closest('[data-bank-exit]')){stopTimer();renderBuilder();return}
 if(!state.session)return;const index=event.target.closest('[data-module-index]');
 try{if(index)state.session=moveToQuestion(state.session,Number(index.dataset.moduleIndex),Date.now());else if(event.target.closest('[data-module-prev]'))state.session=moveToQuestion(state.session,state.session.currentIndex-1,Date.now());else if(event.target.closest('[data-module-next]'))state.session=moveToQuestion(state.session,state.session.currentIndex+1,Date.now());else if(event.target.closest('[data-module-finish]')){finishSession().catch(error=>{alert(error.message);renderQuestion()});return}else return;persistDraft();renderQuestion()}catch(error){alert(error.message)}
});

try{
 const[{catalogs,questions},home]=await Promise.all([loadQuestionBank(),loadJSON('data/home.json')]);setupShell('resolver',home.meta);state.catalogs=catalogs;state.allQuestions=questions;state.draft=readSessionDraft();
 if(!questions.length)throw new Error('O acervo autorizado ainda não possui questões disponíveis.');
 const params=new URLSearchParams(location.search);if(params.get('resume')==='1'&&state.draft?.catalogId?.startsWith('tdas-bank-'))resumeBankSession();else renderBuilder();
}catch(error){setLoadingError(error)}