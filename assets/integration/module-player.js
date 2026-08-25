import {BASE, escapeHTML, loadJSON, setupShell, setLoadingError} from '../common.js?v=26.1';
import {ANSWER_OPTIONS, canFinish, createSession, evaluateSession, formatElapsed, moveToQuestion, selectAnswer, sessionProgress} from './player-core.js?v=1.0.0';
import {saveCompletedAttempt} from './module-store.js?v=2.1.0';
import {clearSessionDraft, matchingSessionDraft, writeSessionDraft} from './session-draft.js?v=1.0.0';

const main=document.querySelector('main');
const state={catalog:null,session:null,responseMeta:{},timer:null,draft:null};
const safeKeyPath=value=>/^data\/integration\/question-keys\/[a-z0-9._-]+\.json$/i.test(String(value||''));

function stopTimer(){if(state.timer)clearInterval(state.timer);state.timer=null}
function updateTimer(){const node=document.querySelector('[data-module-timer]');if(node&&state.session)node.textContent=formatElapsed(Date.now()-state.session.startedAt)}
function startTimer(){stopTimer();updateTimer();state.timer=setInterval(updateTimer,1000)}
function metaFor(id){return{confidence:'secure',marked:false,issue:'none',...(state.responseMeta[id]||{})}}
function persistDraft(){if(!state.session)return;state.draft=writeSessionDraft({catalogId:state.catalog.catalogId,peId:state.catalog.peId,session:state.session,responseMeta:state.responseMeta})}
function resumeDraft(){if(!state.draft)return false;state.session=state.draft.session;state.responseMeta={...state.draft.responseMeta};startTimer();renderQuestion();return true}

function renderEmpty(){
 main.innerHTML=`<section class="hero"><span class="kicker">Resolver · uso real</span><h1>Nenhuma questão disponível</h1><p>O player está operacional, mas nenhum catálogo autorizado foi incorporado ao PE atual.</p><div class="hero-actions"><a class="btn primary" href="${BASE}estudar/">Voltar para Estudar</a><a class="btn" href="${BASE}revisar/">Ver prioridades</a></div></section>`
}

function renderIntro(){
 state.session=null;state.responseMeta={};
 const resume=Boolean(state.draft),progress=resume?sessionProgress(state.draft.session):null,catalog=state.catalog;
 main.innerHTML=`<section class="hero"><span class="kicker">Sessão local</span><h1>${escapeHTML(catalog.title)}</h1><p>${escapeHTML(catalog.description||'Responda todas as questões antes da correção.')}</p><div class="tags"><span class="tag">${catalog.questions.length} ${catalog.questions.length===1?'questão':'questões'}</span><span class="tag">Correção somente ao finalizar</span><span class="tag">Rascunho neste dispositivo</span></div><div class="hero-actions">${resume?`<button class="btn primary" data-module-resume>Continuar questão ${state.draft.session.currentIndex+1} de ${progress.total}</button><button class="btn" data-module-start>Recomeçar</button>`:'<button class="btn primary" data-module-start>Iniciar</button>'}<a class="btn" href="${BASE}estudar/">Voltar</a></div>${resume?`<p><small>${progress.answered} respostas preservadas no rascunho. O gabarito continua indisponível até a finalização.</small></p>`:''}</section>`
}

function renderQuestion(){
 const catalog=state.catalog,progress=sessionProgress(state.session),question=catalog.questions[state.session.currentIndex],selected=state.session.answers[question.id]||'',meta=metaFor(question.id);
 main.innerHTML=`<section class="hero pilot-shell"><div class="pilot-toolbar"><div class="pilot-progress"><div><strong>Questão ${state.session.currentIndex+1} de ${progress.total}</strong> · ${progress.answered} respondidas</div><div class="pilot-progress-track"><div class="pilot-progress-fill" style="width:${progress.percent}%"></div></div></div><strong class="pilot-timer" data-module-timer>${formatElapsed(Date.now()-state.session.startedAt)}</strong></div></section><section class="section pilot-shell"><article class="card panel pilot-question"><span class="kicker">${escapeHTML(question.assunto||'Questão')}</span><h1>${escapeHTML(question.enunciado)}</h1>${question.texto_base?`<blockquote class="pilot-text">${escapeHTML(question.texto_base)}</blockquote>`:''}<fieldset class="pilot-options"><legend class="skip">Escolha uma alternativa</legend>${ANSWER_OPTIONS.filter(option=>question.alternativas?.[option]).map(option=>`<label class="pilot-option"><input type="radio" name="module-answer" value="${option}" ${selected===option?'checked':''}><span><strong>${option})</strong> ${escapeHTML(question.alternativas[option])}</span></label>`).join('')}</fieldset><fieldset class="pilot-meta"><legend><strong>Como você chegou à resposta?</strong></legend><div class="pilot-meta-grid"><label><input type="radio" name="module-confidence" value="secure" ${meta.confidence==='secure'?'checked':''}> Segurança</label><label><input type="radio" name="module-confidence" value="doubt" ${meta.confidence==='doubt'?'checked':''}> Dúvida</label><label><input type="radio" name="module-confidence" value="guess" ${meta.confidence==='guess'?'checked':''}> Chute</label></div><label><input type="checkbox" data-module-marked ${meta.marked?'checked':''}> Marcar para atenção nesta sessão</label><label>Ressalva editorial<select data-module-issue><option value="none" ${meta.issue==='none'?'selected':''}>Nenhuma</option><option value="annulment_pending" ${meta.issue==='annulment_pending'?'selected':''}>Possível anulação</option><option value="source_error" ${meta.issue==='source_error'?'selected':''}>Possível erro da fonte</option></select></label></fieldset></article><article class="card panel"><h2>Mapa da sessão</h2><div class="pilot-map">${catalog.questions.map((item,index)=>`<button class="btn ${state.session.answers[item.id]?'answered':''} ${index===state.session.currentIndex?'current':''}" data-module-index="${index}">${index+1}</button>`).join('')}</div></article><div class="pilot-actions"><button class="btn" data-module-prev ${state.session.currentIndex===0?'disabled':''}>← Anterior</button><a class="btn" href="${BASE}estudar/">Sair</a>${state.session.currentIndex<progress.total-1?'<button class="btn primary" data-module-next>Próxima →</button>':`<button class="btn primary" data-module-finish ${canFinish(state.session)?'':'disabled'}>Finalizar (${progress.remaining} pendentes)</button>`}</div></section>`;
 updateTimer()
}

function renderStudyResult(evaluation,saved){
 const errors=saved.state.errors.length,marked=saved.state.marked.length,editorial=saved.state.aiQueue.length;
 main.innerHTML=`<section class="hero pilot-result"><span class="kicker">Resultado da sessão</span><h1>${evaluation.correct}/${evaluation.total} acertos · ${evaluation.percent.toFixed(0)}%</h1><p>Este resultado fica disponível somente nesta tela para a correção imediata. Ele não foi salvo como histórico pessoal nem enviado para nuvem.</p><div class="tags"><span class="tag">${errors} ${errors===1?'erro':'erros'} nesta bateria</span><span class="tag">${marked} ${marked===1?'marcação':'marcações'} nesta bateria</span><span class="tag">${editorial} ${editorial===1?'ressalva editorial':'ressalvas editoriais'}</span></div><div class="hero-actions"><a class="btn primary" href="${BASE}resolver/">Nova sessão</a><a class="btn" href="${BASE}revisar/">Ver prioridades</a><a class="btn" href="${BASE}mentor/">Abrir Mentor</a></div></section>`
}

async function finishSession(){
 if(!canFinish(state.session))return;
 if(!safeKeyPath(state.catalog.keyPath))throw new Error('O catálogo autorizado não possui caminho de gabarito válido.');
 const key=await fetch(BASE+state.catalog.keyPath,{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error(`Falha ao carregar gabarito (${response.status}).`);return response.json()});
 const evaluation=evaluateSession(state.session,key,Date.now());
 stopTimer();
 const saved=saveCompletedAttempt({catalog:state.catalog,evaluation,responseMeta:state.responseMeta,mode:'study'});
 clearSessionDraft();state.draft=null;renderStudyResult(evaluation,saved)
}

main.addEventListener('change',event=>{
 if(!state.session)return;const questionId=state.session.questionIds[state.session.currentIndex];
 if(event.target.matches('input[name="module-answer"]'))state.session=selectAnswer(state.session,questionId,event.target.value,Date.now());
 else if(event.target.matches('input[name="module-confidence"]'))state.responseMeta[questionId]={...metaFor(questionId),confidence:event.target.value};
 else if(event.target.matches('[data-module-marked]'))state.responseMeta[questionId]={...metaFor(questionId),marked:event.target.checked};
 else if(event.target.matches('[data-module-issue]'))state.responseMeta[questionId]={...metaFor(questionId),issue:event.target.value};
 else return;
 persistDraft();renderQuestion()
});

main.addEventListener('click',event=>{
 if(event.target.closest('[data-module-resume]')){resumeDraft();return}
 if(event.target.closest('[data-module-start]')){clearSessionDraft();state.draft=null;state.session=createSession({id:state.catalog.catalogId,questoes:state.catalog.questions},Date.now());state.responseMeta={};persistDraft();startTimer();renderQuestion();return}
 if(!state.session)return;
 const index=event.target.closest('[data-module-index]');
 if(index)state.session=moveToQuestion(state.session,Number(index.dataset.moduleIndex),Date.now());
 else if(event.target.closest('[data-module-prev]'))state.session=moveToQuestion(state.session,state.session.currentIndex-1,Date.now());
 else if(event.target.closest('[data-module-next]'))state.session=moveToQuestion(state.session,state.session.currentIndex+1,Date.now());
 else if(event.target.closest('[data-module-finish]')){finishSession().catch(error=>alert(error.message));return}
 else return;
 persistDraft();renderQuestion()
});

try{
 const[catalog,shell]=await Promise.all([fetch(BASE+'data/integration/question-catalog.json',{cache:'no-store'}).then(response=>response.json()),loadJSON('data/more.json')]);
 setupShell('mais',shell.meta);state.catalog=catalog;state.draft=matchingSessionDraft(catalog);
 if(!Array.isArray(catalog.questions)||catalog.questions.length===0)renderEmpty();
 else if(state.draft&&new URLSearchParams(location.search).get('resume')==='1')resumeDraft();
 else renderIntro()
}catch(error){setLoadingError(error)}
