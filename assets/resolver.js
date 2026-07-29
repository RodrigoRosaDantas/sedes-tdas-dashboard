import {loadJSON,setupShell,escapeHTML,routes,setLoadingError,fmtPct} from './common.js?v=22';

const params=new URLSearchParams(location.search);
const materialId=params.get('material');
const mode=params.get('modo')==='prova'?'prova':'treino';
const STORAGE_KEY='tdas-question-attempts-v1';
let timerId=null;
let material;
let allQuestions=[];
let activeQuestions=[];
let current=0;
let startedAt=0;
let questionEnteredAt=0;
let answers={};
let flagged=new Set();
let questionTimes={};

const formatTime=ms=>{
  const total=Math.max(0,Math.floor(ms/1000));
  const h=String(Math.floor(total/3600)).padStart(2,'0');
  const m=String(Math.floor(total%3600/60)).padStart(2,'0');
  const s=String(total%60).padStart(2,'0');
  return `${h}:${m}:${s}`;
};
const elapsed=()=>startedAt?Date.now()-startedAt:0;
const updateTimer=()=>document.querySelectorAll('[data-attempt-timer]').forEach(el=>el.textContent=formatTime(elapsed()));
const commitQuestionTime=()=>{
  if(!startedAt||!activeQuestions[current]||!questionEnteredAt)return;
  const id=activeQuestions[current].id;
  questionTimes[id]=(questionTimes[id]||0)+(Date.now()-questionEnteredAt);
  questionEnteredAt=Date.now();
};
const getAttemptHistory=()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{return[]}};
const saveAttempt=attempt=>{
  const history=getAttemptHistory();history.unshift(attempt);localStorage.setItem(STORAGE_KEY,JSON.stringify(history.slice(0,100)));
};

try{
  const [home,data]=await Promise.all([loadJSON('data/home.json'),loadJSON('data/questoes.json')]);
  material=data.materials.find(item=>item.id===materialId);
  if(!material)throw new Error('Material não encontrado. Volte ao acervo e escolha uma prova ou simulado.');
  const map=new Map(data.questions.map(q=>[q.id,q]));
  allQuestions=material.questionIds.map(id=>map.get(id)).filter(Boolean);
  activeQuestions=[...allQuestions];
  setupShell(material.type==='simulado'?'simulados':'provas',home.meta);
  renderIntro();
}catch(error){setLoadingError(error)}

function renderIntro(context=''){
  clearInterval(timerId);timerId=null;startedAt=0;current=0;answers={};flagged=new Set();questionTimes={};
  document.querySelector('main').innerHTML=`
    <section class="hero">
      <span class="kicker">${mode==='treino'?'Modo treino':'Modo prova'}</span>
      <h1>${escapeHTML(context||material.title)}</h1>
      <p>${mode==='treino'?'A correção e os comentários aparecem após cada confirmação.':'O gabarito e os comentários aparecem somente ao finalizar a tentativa.'}</p>
      <div class="tags"><span class="tag">${activeQuestions.length} questões</span><span class="tag">${escapeHTML(material.source)}</span><span class="tag">${escapeHTML(material.role)}</span></div>
      <div class="hero-actions"><button id="start-attempt" class="btn primary">▶ Iniciar tentativa</button><a class="btn" href="${material.type==='simulado'?routes.simulados:routes.provas}">Voltar ao acervo</a></div>
    </section>`;
  document.querySelector('#start-attempt').addEventListener('click',startAttempt);
}

function startAttempt(){
  startedAt=Date.now();questionEnteredAt=Date.now();timerId=setInterval(updateTimer,1000);renderQuestion();updateTimer();
}

function renderQuestion(){
  const q=activeQuestions[current];
  const record=answers[q.id]||{};
  const confirmed=Boolean(record.confirmed);
  const isCorrect=confirmed&&record.selected===q.answer;
  const sideStats={answered:Object.values(answers).filter(a=>a.selected).length,confirmed:Object.values(answers).filter(a=>a.confirmed).length};
  document.querySelector('main').innerHTML=`
    <div class="attempt-head">
      <div class="attempt-title"><small>${mode==='treino'?'Treino com feedback':'Simulação sem feedback imediato'}</small><h1>${escapeHTML(material.title)}</h1></div>
      <div class="timer-pill">⏱ <span data-attempt-timer>${formatTime(elapsed())}</span></div>
    </div>
    <div class="question-layout">
      <section class="card question-card">
        <span class="question-number">Questão ${current+1} de ${activeQuestions.length} · ${escapeHTML(q.discipline)}</span>
        <h2>${escapeHTML(q.statement)}</h2>
        <div class="options">${q.options.map(opt=>{
          const selected=record.selected===opt.key;
          const stateClass=confirmed?(opt.key===q.answer?'correct':selected?'wrong':''):'';
          return `<label class="option ${stateClass}"><input type="radio" name="answer" value="${opt.key}" ${selected?'checked':''} ${mode==='treino'&&confirmed?'disabled':''}><span class="option-key">${opt.key}</span><span>${escapeHTML(opt.text)}</span></label>`;
        }).join('')}</div>
        ${mode==='treino'&&confirmed?renderFeedback(q,record,isCorrect):''}
        <div class="question-actions">
          <div class="action-group"><button class="btn" data-nav="prev" ${current===0?'disabled':''}>← Anterior</button><button class="btn" id="flag-question">${flagged.has(q.id)?'◆ Marcada':'◇ Marcar revisão'}</button></div>
          <div class="action-group">${mode==='treino'&&!confirmed?'<button class="btn primary" id="confirm-answer">Confirmar resposta</button>':''}${mode==='prova'?'<button class="btn primary" id="save-answer">Salvar resposta</button>':''}<button class="btn" data-nav="next">${current===activeQuestions.length-1?'Ir ao fechamento':'Próxima →'}</button></div>
        </div>
      </section>
      <aside class="attempt-side">
        <article class="card side-card"><h3>Mapa da tentativa</h3><div class="progress-map">${activeQuestions.map((item,index)=>progressButton(item,index)).join('')}</div></article>
        <article class="card side-card"><h3>Resumo</h3><div class="stat-line"><span>Respondidas</span><strong>${sideStats.answered}/${activeQuestions.length}</strong></div><div class="stat-line"><span>Confirmadas</span><strong>${mode==='treino'?sideStats.confirmed:'—'}</strong></div><div class="stat-line"><span>Marcadas</span><strong>${flagged.size}</strong></div><button id="finish-attempt" class="btn primary" style="width:100%;margin-top:12px">Finalizar tentativa</button></article>
      </aside>
    </div>`;

  document.querySelectorAll('input[name="answer"]').forEach(input=>input.addEventListener('change',e=>{answers[q.id]={...(answers[q.id]||{}),selected:e.target.value};renderQuestion()}));
  document.querySelector('#confirm-answer')?.addEventListener('click',()=>confirmAnswer(q));
  document.querySelector('#save-answer')?.addEventListener('click',()=>{if(!answers[q.id]?.selected){alert('Selecione uma alternativa antes de salvar.');return}goNext()});
  document.querySelector('#flag-question').addEventListener('click',()=>{flagged.has(q.id)?flagged.delete(q.id):flagged.add(q.id);renderQuestion()});
  document.querySelectorAll('[data-nav="prev"]').forEach(btn=>btn.addEventListener('click',()=>goTo(current-1)));
  document.querySelectorAll('[data-nav="next"]').forEach(btn=>btn.addEventListener('click',goNext));
  document.querySelectorAll('[data-question-index]').forEach(btn=>btn.addEventListener('click',()=>goTo(Number(btn.dataset.questionIndex))));
  document.querySelector('#finish-attempt').addEventListener('click',finalizeAttempt);
}

function progressButton(q,index){
  const record=answers[q.id]||{};let cls=index===current?'current ':'';
  if(mode==='treino'&&record.confirmed)cls+=record.selected===q.answer?'correct ':'wrong ';else if(record.selected)cls+='answered ';
  if(flagged.has(q.id))cls+='flagged ';
  return `<button class="progress-dot ${cls}" data-question-index="${index}" aria-label="Ir para questão ${index+1}">${index+1}</button>`;
}

function confirmAnswer(q){
  const selected=answers[q.id]?.selected;if(!selected){alert('Selecione uma alternativa antes de confirmar.');return}
  answers[q.id]={selected,confirmed:true};renderQuestion();
}

function renderFeedback(q,record,isCorrect){
  return `<article class="feedback ${isCorrect?'correct':'wrong'}"><h3>${isCorrect?'✅ Resposta correta':'❌ Resposta incorreta'}</h3><p>Você marcou <strong>${escapeHTML(record.selected)}</strong>. Gabarito: <strong>${escapeHTML(q.answer)}</strong>.</p><p>${escapeHTML(q.generalComment||'')}</p>${q.legalBasis?`<p><strong>Fundamento:</strong> ${escapeHTML(q.legalBasis)}</p>`:''}${q.trick?`<p><strong>Pegadinha:</strong> ${escapeHTML(q.trick)}</p>`:''}<details><summary>Comentários das alternativas</summary><div class="comment-list">${q.options.map(opt=>`<div class="comment-item"><strong>${opt.key})</strong> ${escapeHTML(opt.comment||'Sem comentário específico.')}</div>`).join('')}</div></details></article>`;
}

function goTo(index){
  if(index<0||index>=activeQuestions.length)return;commitQuestionTime();current=index;questionEnteredAt=Date.now();renderQuestion();
}
function goNext(){
  if(current===activeQuestions.length-1){finalizeAttempt();return}goTo(current+1);
}

function finalizeAttempt(){
  commitQuestionTime();clearInterval(timerId);timerId=null;
  const valid=activeQuestions.filter(q=>!q.annulled);
  const answered=activeQuestions.filter(q=>answers[q.id]?.selected);
  const correct=valid.filter(q=>answers[q.id]?.selected===q.answer);
  const wrong=valid.filter(q=>answers[q.id]?.selected&&answers[q.id].selected!==q.answer);
  const blank=valid.filter(q=>!answers[q.id]?.selected);
  const pct=valid.length?correct.length/valid.length*100:0;
  const disciplines={};
  valid.forEach(q=>{const row=disciplines[q.discipline]||(disciplines[q.discipline]={total:0,correct:0});row.total++;if(answers[q.id]?.selected===q.answer)row.correct++});
  const attempt={id:`${material.id}-${Date.now()}`,materialId:material.id,title:material.title,type:material.type,mode,finishedAt:new Date().toISOString(),durationMs:elapsed(),total:valid.length,answered:answered.length,correct:correct.length,wrong:wrong.length,blank:blank.length,percentage:pct,answers,questionTimes,flagged:[...flagged]};
  saveAttempt(attempt);
  document.querySelector('main').innerHTML=`
    <section class="card result-hero"><span class="kicker">Resultado final</span><strong>${fmtPct(pct,1)}</strong><h1>${escapeHTML(material.title)}</h1><span>Tempo total: ${formatTime(attempt.durationMs)} · Média: ${formatTime(attempt.durationMs/Math.max(1,valid.length))} por questão</span></section>
    <section class="section"><div class="grid result-grid"><article class="card metric"><small>Acertos</small><strong>${correct.length}</strong><span>de ${valid.length}</span></article><article class="card metric"><small>Erros</small><strong>${wrong.length}</strong><span>questões</span></article><article class="card metric"><small>Em branco</small><strong>${blank.length}</strong><span>questões</span></article><article class="card metric"><small>Marcadas</small><strong>${flagged.size}</strong><span>para revisão</span></article></div></section>
    <section class="section"><div class="section-head"><div><h2>Desempenho por disciplina</h2><p>O histórico desta tentativa foi salvo neste navegador.</p></div></div><div class="table-wrap"><table><thead><tr><th>Disciplina</th><th>Acertos</th><th>Total</th><th>Aproveitamento</th></tr></thead><tbody>${Object.entries(disciplines).map(([name,row])=>`<tr><td>${escapeHTML(name)}</td><td>${row.correct}</td><td>${row.total}</td><td>${fmtPct(row.correct/row.total*100,1)}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="section"><div class="section-head"><div><h2>Revisão da tentativa</h2><p>Gabarito, resposta marcada e comentários.</p></div></div><div class="review-list">${activeQuestions.map(q=>renderReview(q)).join('')}</div></section>
    <section class="section"><div class="hero-actions">${wrong.length?'<button id="retry-wrong" class="btn primary">Refazer somente as erradas</button>':''}<a class="btn" href="${material.type==='simulado'?routes.simulados:routes.provas}">Voltar ao acervo</a></div></section>`;
  document.querySelector('#retry-wrong')?.addEventListener('click',()=>{activeQuestions=wrong;renderIntro('Revisão das questões erradas')});
}

function renderReview(q){
  const selected=answers[q.id]?.selected||'Em branco';const correct=selected===q.answer;
  return `<article class="card review-item" data-result="${correct?'correct':'wrong'}"><span class="question-number">Questão ${q.number} · ${escapeHTML(q.discipline)}</span><h3>${escapeHTML(q.statement)}</h3><p>Você marcou <strong>${escapeHTML(selected)}</strong> · Gabarito <strong>${escapeHTML(q.answer)}</strong> · Tempo ${formatTime(questionTimes[q.id]||0)}</p><p>${escapeHTML(q.generalComment||'')}</p>${q.trick?`<p><strong>Pegadinha:</strong> ${escapeHTML(q.trick)}</p>`:''}</article>`;
}
