import {BASE,escapeHTML,loadJSON,setupShell,setLoadingError} from '../common.js?v=28.0.0';
import {readModuleState} from './module-store.js?v=2.2.0';
import {getAttemptExport,downloadAttemptExport,downloadAttemptReport,copyAttemptSummary} from './attempt-history-v2.js?v=2.1.0';
import {syncPrivateHistory} from './private-history-sync-v3.js?v=3.1.0';
import {hydratePrivateHistory} from './private-history-materialize.js?v=1.0.0';
import {buildStudyAnalytics} from './study-analytics.js?v=1.1.0';

const time=ms=>{
  if(ms==null)return'não medido';
  const total=Math.max(0,Math.round(Number(ms)/1000)),hours=Math.floor(total/3600),minutes=Math.floor((total%3600)/60),seconds=total%60,parts=[];
  if(hours)parts.push(`${hours}h`);
  if(minutes)parts.push(`${minutes}min`);
  if(!hours&&!minutes||seconds&&parts.length<2)parts.push(`${seconds}s`);
  return parts.join(' ');
};
const confidence=v=>v==='guess'?'chute':v==='doubt'?'dúvida':'segurança';
const buildCompleteHandoff=data=>[
  '# Dados completos TDAS para ChatGPT / Notion',
  `**Tentativa única:** ${data.attempt.id}`,
  `**PE/bloco:** ${data.attempt.peId||'não informado'}`,
  '',
  'Use este pacote como evidência de execução quando eu solicitar a atualização do Notion. O Notion permanece a fonte oficial consolidada. Não conte novamente uma tentativa com o mesmo `attempt.id`. Preserve respostas e histórico já registrados. Itens sinalizados como possível anulação ou erro da fonte não devem ser consolidados como erro real sem validação.',
  '',
  '```json',
  JSON.stringify(data,null,2),
  '```'
].join('\n');

function card(q){
  const alternatives=Object.entries(q.alternativas||{}).map(([k,v])=>`<li class="${k===q.correctAnswer?'correct':''} ${k===q.selected&&!q.correct?'selected-wrong':''}"><strong>${escapeHTML(k)}${k.length===1?')':''}</strong> ${escapeHTML(v)}</li>`).join('');
  return `<details class="card panel attempt-question ${q.correct?'is-correct':'is-wrong'}" ${!q.correct?'open':''}><summary><span><small>Questão ${escapeHTML(q.numeroOriginal??q.id)} · ${escapeHTML(q.materia||q.assunto||'Sem matéria')}</small><strong>${escapeHTML(q.subassunto||q.assunto||'Questão')}</strong></span><b>${q.correct?'✓ Acerto':'✕ Erro'}</b></summary><div class="attempt-question-body">${q.textoBase?`<blockquote>${escapeHTML(q.textoBase)}</blockquote>`:''}<p class="attempt-stem">${escapeHTML(q.enunciado||'Enunciado histórico não disponível.')}</p><ol class="attempt-options">${alternatives}</ol><div class="attempt-answer-grid"><div class="attempt-answer ${q.correct?'right':'wrong'}"><small>Sua resposta</small><strong>${escapeHTML(q.selected||'—')}</strong><p>${escapeHTML(q.selectedText||'')}</p></div><div class="attempt-answer right"><small>Gabarito</small><strong>${escapeHTML(q.correctAnswer||'—')}</strong><p>${escapeHTML(q.correctText||'')}</p></div></div><p>Confiança: <strong>${confidence(q.confidence)}</strong> · Tempo ativo: <strong>${time(q.activeMs)}</strong> · Visitas: <strong>${Number(q.visits||0)}</strong> · Trocas: <strong>${Number(q.answerChanges||0)}</strong></p>${q.diagnostico?`<div class="attempt-diagnosis"><strong>Diagnóstico</strong><p>${escapeHTML(q.diagnostico)}</p></div>`:''}${q.comentario?`<div class="attempt-explanation"><strong>Comentário editorial</strong><p>${escapeHTML(q.comentario)}</p></div>`:''}${q.fundamento?`<div class="attempt-explanation"><strong>Fundamento</strong><p>${escapeHTML(q.fundamento)}</p></div>`:''}${q.pegadinha?`<div class="attempt-explanation"><strong>Pegadinha</strong><p>${escapeHTML(q.pegadinha)}</p></div>`:''}${!q.comentario&&!q.fundamento&&!q.correct?'<div class="attempt-explanation muted"><strong>Explicação não estruturada na fonte</strong><p>Use “Copiar análise para ChatGPT”: o relatório inclui a questão inteira, sua resposta e o gabarito para análise sem inventar um fundamento local.</p></div>':''}</div></details>`;
}

function subjectPerformance(questions){
  const map=new Map();
  for(const question of questions){
    const label=question.materia||question.assunto||'Sem matéria';
    const item=map.get(label)||{label,total:0,correct:0};
    item.total+=1;
    if(question.correct)item.correct+=1;
    map.set(label,item);
  }
  return [...map.values()].map(item=>({...item,percent:item.total?item.correct/item.total*100:0})).sort((a,b)=>a.percent-b.percent||b.total-a.total||a.label.localeCompare(b.label,'pt-BR'));
}

function performanceRows(items){
  if(!items.length)return'';
  return `<div class="attempt-subject-performance"><div class="section-head attempt-subject-head"><div><h3>Desempenho por matéria</h3><p>Recorte calculado somente com as questões desta tentativa.</p></div></div><div class="attempt-subject-list">${items.map(item=>`<div class="attempt-subject-row"><div><strong>${escapeHTML(item.label)}</strong><small>${item.correct}/${item.total} acertos</small></div><div class="attempt-subject-meter" aria-hidden="true"><span style="width:${Math.max(0,Math.min(100,item.percent)).toFixed(1)}%"></span></div><strong>${item.percent.toFixed(1).replace('.',',')}%</strong></div>`).join('')}</div></div>`;
}

try{
  const shell=await loadJSON('data/more.json');
  setupShell('mais',shell.meta);
  try{
    if(navigator.onLine)await syncPrivateHistory();
    await hydratePrivateHistory();
  }catch{}
  const state=readModuleState(),params=new URLSearchParams(location.search),id=params.get('id')||state.attempts[0]?.id;
  if(!id)throw new Error('Nenhuma tentativa disponível.');
  const data=await getAttemptExport(id);
  if(!data)throw new Error('Tentativa não encontrada.');
  const analytics=buildStudyAnalytics({attempts:state.attempts,reviews:state.reviews}),main=document.querySelector('main'),origin=state.attempts.find(x=>x.id===id)?.syncStatus==='synced'?'Sincronizado':'Disponível localmente',attention=data.questions.filter(q=>!q.correct||q.confidence!=='secure'||q.marked||q.issue!=='none'),subjects=subjectPerformance(data.questions),correct=Number(data.attempt.correct||0),total=Number(data.attempt.total||0),incorrect=Number(data.attempt.incorrect??Math.max(0,total-correct)),percent=Number(data.attempt.percent||0);

  main.innerHTML=`<section class="hero attempt-report-hero"><span class="kicker">Relatório de tentativa · ${origin}</span><h1>${escapeHTML(data.attempt.peId||'Tentativa')} · ${correct}/${total}</h1><p>${percent.toFixed(1).replace('.',',')}% · ${attention.length} item(ns) merecem revisão.</p><div class="hero-actions attempt-report-actions"><button class="btn primary" type="button" data-print>Imprimir / Salvar em PDF</button><a class="btn" href="${BASE}desempenho/">Voltar ao desempenho</a><button class="btn" type="button" data-copy-full>Copiar dados para ChatGPT / Notion</button><button class="btn" type="button" data-copy>Copiar análise pedagógica</button><button class="btn" type="button" data-md>Baixar relatório .md</button><button class="btn" type="button" data-json>Baixar dados .json</button></div><p data-message aria-live="polite"></p></section><section class="section attempt-report-performance" data-attempt-performance><div class="section-head"><div><span class="kicker">Desempenho da tentativa</span><h2>Resultado desta execução</h2><p>Os indicadores abaixo usam exclusivamente as respostas registradas nesta tentativa.</p></div></div><div class="attempt-summary-grid"><article class="card"><small>Acertos</small><strong>${correct}</strong><span>de ${total}</span></article><article class="card"><small>Erros</small><strong>${incorrect}</strong><span>nesta tentativa</span></article><article class="card"><small>Aproveitamento</small><strong>${percent.toFixed(1).replace('.',',')}%</strong><span>resultado da tentativa</span></article><article class="card"><small>Para revisar</small><strong>${attention.length}</strong><span>erros, dúvidas ou marcações</span></article></div><div class="attempt-performance-meta"><span>Tempo total <strong>${time(data.attempt.elapsedMs)}</strong></span><span>Tempo ativo <strong>${time(data.attempt.activeElapsedMs)}</strong></span><span>Revisitas <strong>${Number(data.attempt.revisitCount||0)}</strong></span><span>Trocas de resposta <strong>${Number(data.attempt.answerChangeCount||0)}</strong></span></div>${performanceRows(subjects)}</section><section class="section attempt-report-questions"><div class="section-head"><div><h2>Questão por questão</h2><p>Conteúdo, sua resposta, gabarito, diagnóstico, confiança, telemetria e fundamento quando disponível.</p></div></div><div class="attempt-list">${data.questions.map(card).join('')}</div></section>`;

  main.querySelector('[data-json]').onclick=()=>downloadAttemptExport(data);
  main.querySelector('[data-md]').onclick=()=>downloadAttemptReport(data,{risk:analytics.topics.slice(0,10)});
  main.querySelector('[data-copy-full]').onclick=async()=>{
    await navigator.clipboard.writeText(buildCompleteHandoff(data));
    main.querySelector('[data-message]').textContent=`Dados completos copiados: ${data.questions.length} questão(ões), tentativa ${data.attempt.id}. Cole no ChatGPT para atualizar o Notion.`;
  };
  main.querySelector('[data-copy]').onclick=async()=>{
    await copyAttemptSummary(data,{risk:analytics.topics.slice(0,10)});
    main.querySelector('[data-message]').textContent='Análise pedagógica copiada. Cole direto no ChatGPT.';
  };

  const questionDetails=[...main.querySelectorAll('.attempt-question')];
  let printOpenState=[];
  const preparePrint=()=>{
    printOpenState=questionDetails.map(item=>item.open);
    questionDetails.forEach(item=>{item.open=true});
  };
  const restorePrint=()=>{
    questionDetails.forEach((item,index)=>{item.open=printOpenState[index]??item.open});
  };
  window.addEventListener('beforeprint',preparePrint);
  window.addEventListener('afterprint',restorePrint);
  main.querySelector('[data-print]').onclick=()=>window.print();
}catch(error){
  setLoadingError(error);
}
