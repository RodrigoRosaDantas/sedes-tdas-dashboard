import{loadJSON,setupShell,escapeHTML,fmtNumber,fmtPct,fmtDateTime,metric,setLoadingError}from'./common.js';

const riskMeta={
 critical:{label:'Crítico',icon:'🔴',rank:5},
 attention:{label:'Atenção',icon:'🟠',rank:4},
 no_evidence:{label:'Risco sem evidência',icon:'⚪',rank:3},
 stable:{label:'Estável',icon:'🟡',rank:2},
 strong:{label:'Forte',icon:'🟢',rank:1},
 unknown:{label:'Sem classificação',icon:'○',rank:0}
};
const viewMeta={all:{label:'Todos'},unmeasured:{label:'Sem bateria'},critical:{label:'Críticos'},attention:{label:'Atenção'},consolidated:{label:'Consolidados'},review:{label:'Revisar'}};
const coverageMeta={studied:'Estudado',review:'Em revisão',not_studied:'Não estudado',unknown:'Sem classificação'};
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const number=value=>Number.isFinite(Number(value))?Number(value):null;
const fmtAccuracy=value=>number(value)==null?'—':fmtPct(number(value),1);
const fmtDate=value=>value?fmtDateTime(value):'—';
const riskLabel=risk=>riskMeta[risk]||riskMeta.unknown;
const safe=value=>escapeHTML(value||'—');
const canonicalId=item=>item.canonicalId||`TDAS202:${String(item.id||'').replaceAll('-','').toLowerCase()}`;
const unique=values=>[...new Set(values.filter(Boolean))];
function refsOf(item){
 const stored=item.references||{},raw=String(item.evidence||'');
 const pes=Array.isArray(stored.pes)?stored.pes:unique([...raw.matchAll(/\bPE\s*0*(\d{1,3})\b/gi)].map(match=>`PE${String(Number(match[1])).padStart(2,'0')}`));
 const questions=Array.isArray(stored.questions)?stored.questions:unique([...raw.matchAll(/\bPE\s*0*(\d{1,3})\s*\/\s*Q\s*0*(\d{1,3})\b/gi)].map(match=>`PE${String(Number(match[1])).padStart(2,'0')}/Q${Number(match[2])}`));
 return{pes,questions};
}
function measurementOf(item){
 const q=number(item.measurement?.questions??item.questions)??0,explicit=item.measurement?.state;
 const measured=explicit==='measured'||(!explicit&&q>0),correct=measured?(number(item.measurement?.correct??item.correct)??0):null;
 const accuracy=measured?number(item.measurement?.accuracy??item.accuracy):null;
 return{state:measured?'measured':'unmeasured',questions:q,correct,errors:measured?Math.max(0,q-correct):null,accuracy};
}
function topicOrder(a,b){
 const risk=(riskLabel(b.risk).rank-riskLabel(a.risk).rank);if(risk)return risk;
 const priority={alta:3,media:2,baixa:1};
 const p=(priority[norm(b.priority)]||0)-(priority[norm(a.priority)]||0);if(p)return p;
 const accuracy=(measurementOf(a).accuracy??101)-(measurementOf(b).accuracy??101);if(accuracy)return accuracy;
 return String(a.topic||'').localeCompare(String(b.topic||''),'pt-BR');
}
function options(values){return[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(value=>`<option value="${safe(value)}">${safe(value)}</option>`).join('')}
function riskPill(risk){const item=riskLabel(risk);return`<span class="edital-pill" data-risk="${safe(risk||'unknown')}">${item.icon} ${item.label}</span>`}
function actionText(item){return item.nextAction||item.strategicAction||'Sem ação automática'}
function evidenceText(item){const m=measurementOf(item);return m.state==='measured'?`${fmtNumber(m.correct)}/${fmtNumber(m.questions)} · ${fmtAccuracy(m.accuracy)}`:'— · sem bateria granular'}
function refsText(item){const refs=refsOf(item),parts=[];if(refs.pes.length)parts.push(`PE: ${refs.pes.join(', ')}`);if(refs.questions.length)parts.push(`Questões explícitas: ${refs.questions.join(', ')}`);return parts.length?parts.join(' · '):'Nenhum PE/Q explícito extraído da evidência textual.'}
function topicDetails(item){
 const m=measurementOf(item),coverage=coverageMeta[item.coverageBucket]||item.coverage||'Sem classificação';
 return`<details class="edital-detail"><summary>Ver análise</summary><div class="edital-detail-grid"><div><small>Cobertura</small><strong>${safe(coverage)}</strong><span>${safe(item.evidence||'Sem evidência textual')}</span></div><div><small>Evidência objetiva</small><strong>${m.state==='measured'?'Bateria específica':'Ainda insuficiente'}</strong><span>${safe(refsText(item))}</span></div><div><small>Desempenho</small><strong>${m.state==='measured'?`${fmtAccuracy(m.accuracy)} · ${fmtNumber(m.errors)} erro(s)`:'—'}</strong><span>${m.state==='measured'?`${fmtNumber(m.correct)} acertos em ${fmtNumber(m.questions)} questões vinculadas`:'Ausência de bateria não é 0%.'}</span></div><div><small>Risco atual</small><strong>${riskPill(item.risk)}</strong><span>${safe(actionText(item))}</span></div></div><div class="edital-detail-foot"><span class="mono">${safe(canonicalId(item))}</span><span>Última revisão: ${safe(item.lastReview||'—')}</span><a href="${safe(item.url)}" target="_blank" rel="noopener">Abrir fonte no Notion ↗</a></div></details>`;
}
function topicRow(item){
 return`<tr data-topic-row><td data-label="Código"><span class="mono">${safe(item.code)}</span></td><td data-label="Tópico"><div class="edital-topic"><strong>${safe(item.topic)}</strong><small>${safe(item.evidence||item.block)}</small>${topicDetails(item)}</div></td><td data-label="Disciplina">${safe(item.discipline)}</td><td data-label="Raio-X">${riskPill(item.risk)}</td><td data-label="Cobertura">${safe(coverageMeta[item.coverageBucket]||item.coverage)}</td><td data-label="Prioridade"><span class="edital-priority">${safe(item.priority)}</span></td><td data-label="Bateria tópica">${safe(evidenceText(item))}</td><td data-label="Próxima ação"><strong>${safe(actionText(item))}</strong></td></tr>`
}
function disciplineCard(item){const measured=number(item.questionItems)||0,unmeasured=number(item.unmeasured)??Math.max(0,(number(item.items)||0)-measured);return`<article class="card edital-discipline"><small>${safe(item.discipline)}</small><strong>${fmtNumber(item.items)} tópicos</strong><div class="edital-discipline-counts"><span>🔴 ${fmtNumber(item.critical)}</span><span>🟠 ${fmtNumber(item.attention)}</span><span>⚪ ${fmtNumber(item.noEvidence)}</span></div><p><strong>Bateria:</strong> ${fmtNumber(measured)} aferidos · ${fmtNumber(unmeasured)} sem bateria${measured?` · ${fmtAccuracy(item.accuracy)}`:''}.</p></article>`}
function viewMatch(item,view){const measured=measurementOf(item).state==='measured';if(view==='unmeasured')return!measured;if(view==='critical')return item.risk==='critical';if(view==='attention')return item.risk==='attention';if(view==='consolidated')return item.risk==='strong'||item.risk==='stable';if(view==='review')return item.risk==='critical'||item.risk==='attention';return true}

try{
 const[data,home]=await Promise.all([loadJSON('data/edital-status.json'),loadJSON('data/home.json')]);
 setupShell('evolucao',home.meta||{});
 const summary=data.summary||{},coverage=summary.coverage||{},risk=summary.risk||{};
 const topics=(Array.isArray(data.topics)&&data.topics.length?data.topics:data.priorityTopics||[]).slice().sort(topicOrder);
 const fullCatalog=topics.length===Number(summary.total||0),measured=number(summary.evidence?.measured??summary.questionItems)??topics.filter(item=>measurementOf(item).state==='measured').length,unmeasured=number(summary.evidence?.unmeasured)??Math.max(0,topics.length-measured);
 const source=data.source||{},disciplines=Array.isArray(data.disciplines)?data.disciplines:[],current=home.latest||home.today||{};
 document.querySelector('main').innerHTML=`
 <section class="hero edital-hero"><span class="kicker">Edital inteligente · Cargo 202</span><h1>O que já foi coberto — e onde ainda há risco</h1><p>O painel agora separa quatro dimensões que não devem ser confundidas: <strong>cobertura</strong>, <strong>evidência objetiva</strong>, <strong>desempenho tópico</strong> e <strong>risco atual</strong>. Estudado não significa dominado; sem bateria não significa 0%.</p><div class="hero-actions"><a class="btn primary" href="#topicos">Ver os ${fmtNumber(summary.total||topics.length)} tópicos</a><a class="btn" href="${safe(source.checkUrl)}" target="_blank" rel="noopener">Abrir análise no Notion ↗</a><a class="btn" href="${safe(source.viewUrl||source.url)}" target="_blank" rel="noopener">Abrir banco ↗</a></div></section>
 <section class="grid metrics edital-metrics">
  ${metric('Cobertura',`${fmtNumber((coverage.studied||0)+(coverage.review||0))}/${fmtNumber(summary.total||0)}`,summary.contentGaps?'Ainda existem lacunas reais':'0 lacunas de conteúdo identificadas')}
  ${metric('Aferidos',`${fmtNumber(measured)}/${fmtNumber(summary.total||topics.length)}`,'Com Questões/Acertos individualizados')}
  ${metric('Sem bateria',fmtNumber(unmeasured),'Estudados sem percentual tópico confiável')}
  ${metric('Críticos',fmtNumber(risk.critical||0),'Risco histórico/prioridade de revisão')}
  ${metric('Em atenção',fmtNumber(risk.attention||0),'Erro real ou sinal recente de atenção')}
  ${metric('Último PE',safe(current.pe||'—'),current.accuracy!=null?`${fmtAccuracy(current.accuracy)} · ${fmtNumber(current.acertos||0)}/${fmtNumber(current.attempted||current.meta||0)}`:'Sem resultado')}
 </section>
 <section class="section"><article class="card edital-reading"><div><span class="edital-reading-icon">🧭</span></div><div><h2>Leitura correta do painel</h2><p><strong>${fmtNumber(summary.total||0)} tópicos cobertos</strong> responde “já passei pelo conteúdo?”. A bateria individual responde “já consigo medir este tópico?”. Hoje são <strong>${fmtNumber(measured)} aferidos</strong> e <strong>${fmtNumber(unmeasured)} sem bateria granular</strong>. Já o Raio-X histórico mantém <strong>${fmtNumber(risk.critical||0)} críticos</strong> e <strong>${fmtNumber(risk.attention||0)} em atenção</strong>. Essas camadas são independentes.</p><small>Percentuais só aparecem quando existem Questões/Acertos vinculados ao tópico. O desempenho global de um PE nunca é distribuído artificialmente entre assuntos. Gerado em ${fmtDate(data.generatedAt)}.</small></div></article></section>
 <section class="section"><div class="section-head"><div><h2>Raio-X por disciplina</h2><p>Risco histórico e cobertura de bateria aparecem separados para evitar falsa sensação de domínio.</p></div></div><div class="grid portal-grid edital-disciplines">${disciplines.map(disciplineCard).join('')}</div></section>
 <section class="section" id="topicos"><div class="section-head"><div><h2>Checklist completo do edital</h2><p>Use as visões rápidas para transformar o checklist em fila de decisão: aferir o que está sem bateria e revisar o que está em risco.</p></div><span class="stamp" id="result-count" aria-live="polite">${fmtNumber(topics.length)} itens</span></div>
 <div class="edital-quickviews" aria-label="Visões rápidas">${Object.entries(viewMeta).map(([key,value])=>`<button class="btn edital-view" type="button" data-view="${key}">${value.label}</button>`).join('')}</div>
 <div class="card edital-filters" role="search"><label>Pesquisar<input id="edital-search" type="search" placeholder="Ex.: crase, PAD, Cartão Gás…" autocomplete="off"></label><label>Disciplina<select id="edital-discipline"><option value="">Todas</option>${options(topics.map(x=>x.discipline))}</select></label><label>Raio-X<select id="edital-risk"><option value="">Todos</option>${Object.entries(riskMeta).filter(([key])=>key!=='unknown').map(([key,value])=>`<option value="${key}">${value.icon} ${value.label}</option>`).join('')}</select></label><label>Bloco<select id="edital-block"><option value="">Todos</option>${options(topics.map(x=>x.block))}</select></label><button class="btn" type="button" id="edital-clear">Limpar filtros</button></div>
 ${fullCatalog?'':`<article class="card alert" data-level="warning"><span class="alert-icon">△</span><div><b>Snapshot parcial</b><p>O resumo informa ${fmtNumber(summary.total||0)} itens, mas este arquivo trouxe ${fmtNumber(topics.length)} registros detalhados. O painel não inventará os itens ausentes.</p></div></article>`}
 <div class="table-wrap edital-table-wrap"><table class="edital-table"><thead><tr><th>Código</th><th>Tópico</th><th>Disciplina</th><th>Raio-X</th><th>Cobertura</th><th>Prioridade</th><th>Bateria tópica</th><th>Próxima ação</th></tr></thead><tbody id="edital-body">${topics.map(topicRow).join('')}</tbody></table><div class="empty" id="edital-empty" hidden>Nenhum tópico corresponde aos filtros atuais.</div></div></section>
 <footer class="footer"><span>Edital inteligente · Cargo 202</span><span>Snapshot <span data-snapshot></span> · última leitura do checklist ${fmtDate(source.lastEditedTime)}</span></footer>`;
 const search=document.querySelector('#edital-search'),discipline=document.querySelector('#edital-discipline'),riskFilter=document.querySelector('#edital-risk'),block=document.querySelector('#edital-block'),clear=document.querySelector('#edital-clear'),body=document.querySelector('#edital-body'),count=document.querySelector('#result-count'),empty=document.querySelector('#edital-empty'),viewButtons=[...document.querySelectorAll('[data-view]')];
 const params=new URLSearchParams(location.search);let view=viewMeta[params.get('view')]?params.get('view'):'all';search.value=params.get('q')||'';discipline.value=params.get('discipline')||'';riskFilter.value=params.get('risk')||'';block.value=params.get('block')||'';
 function update(){const q=norm(search.value.trim()),d=discipline.value,r=riskFilter.value,b=block.value;const visible=topics.filter(item=>viewMatch(item,view)&&(!q||norm(`${item.code} ${item.topic} ${item.discipline} ${item.block} ${item.evidence} ${item.nextAction} ${canonicalId(item)}`).includes(q))&&(!d||item.discipline===d)&&(!r||item.risk===r)&&(!b||item.block===b));body.innerHTML=visible.map(topicRow).join('');count.textContent=`${fmtNumber(visible.length)} de ${fmtNumber(topics.length)} itens`;empty.hidden=visible.length>0;viewButtons.forEach(button=>{const active=button.dataset.view===view;button.classList.toggle('primary',active);button.setAttribute('aria-pressed',String(active))});const next=new URLSearchParams();if(view!=='all')next.set('view',view);if(search.value.trim())next.set('q',search.value.trim());if(d)next.set('discipline',d);if(r)next.set('risk',r);if(b)next.set('block',b);history.replaceState(null,'',`${location.pathname}${next.size?`?${next}`:''}${location.hash||''}`)}
 [search,discipline,riskFilter,block].forEach(control=>control.addEventListener(control===search?'input':'change',update));viewButtons.forEach(button=>button.addEventListener('click',()=>{view=button.dataset.view||'all';update()}));clear.addEventListener('click',()=>{view='all';search.value='';discipline.value='';riskFilter.value='';block.value='';update();search.focus()});update();
}catch(error){setLoadingError(error)}
