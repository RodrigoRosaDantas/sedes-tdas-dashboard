import{loadJSON,setupShell,escapeHTML,fmtNumber,fmtPct,fmtDateTime,metric,setLoadingError}from'./common.js?v=26.17.0';

const riskMeta={
 critical:{label:'Crítico',icon:'🔴',rank:5},
 attention:{label:'Atenção',icon:'🟠',rank:4},
 no_evidence:{label:'Sem aferição',icon:'⚪',rank:3},
 stable:{label:'Estável',icon:'🟡',rank:2},
 strong:{label:'Forte',icon:'🟢',rank:1},
 unknown:{label:'Sem classificação',icon:'○',rank:0}
};
const coverageMeta={studied:'Estudado',review:'Em revisão',not_studied:'Não estudado',unknown:'Sem classificação'};
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const number=value=>Number.isFinite(Number(value))?Number(value):null;
const fmtAccuracy=value=>number(value)==null?'—':fmtPct(number(value),1);
const fmtDate=value=>value?fmtDateTime(value):'—';
const riskLabel=risk=>riskMeta[risk]||riskMeta.unknown;
const safe=value=>escapeHTML(value||'—');

function topicOrder(a,b){
 const risk=(riskLabel(b.risk).rank-riskLabel(a.risk).rank);if(risk)return risk;
 const priority={alta:3,media:2,baixa:1};
 const p=(priority[norm(b.priority)]||0)-(priority[norm(a.priority)]||0);if(p)return p;
 const accuracy=(number(a.accuracy)??101)-(number(b.accuracy)??101);if(accuracy)return accuracy;
 return String(a.topic||'').localeCompare(String(b.topic||''),'pt-BR');
}
function options(values){return[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(value=>`<option value="${safe(value)}">${safe(value)}</option>`).join('')}
function riskPill(risk){const item=riskLabel(risk);return`<span class="edital-pill" data-risk="${safe(risk||'unknown')}">${item.icon} ${item.label}</span>`}
function actionText(item){return item.nextAction||item.strategicAction||'Sem ação automática'}
function topicRow(item){
 const q=number(item.questions),a=number(item.correct),evidence=q&&q>0?`${fmtNumber(a||0)}/${fmtNumber(q)} · ${fmtAccuracy(item.accuracy)}`:'Sem bateria específica';
 return`<tr data-topic-row><td data-label="Código"><span class="mono">${safe(item.code)}</span></td><td data-label="Tópico"><div class="edital-topic"><strong>${safe(item.topic)}</strong><small>${safe(item.evidence||item.block)}</small></div></td><td data-label="Disciplina">${safe(item.discipline)}</td><td data-label="Raio-X">${riskPill(item.risk)}</td><td data-label="Cobertura">${safe(coverageMeta[item.coverageBucket]||item.coverage)}</td><td data-label="Prioridade"><span class="edital-priority">${safe(item.priority)}</span></td><td data-label="Questões">${safe(evidence)}</td><td data-label="Próxima ação"><strong>${safe(actionText(item))}</strong></td><td data-label="Fonte"><a class="linked-id" href="${safe(item.url)}" target="_blank" rel="noopener">Notion ↗</a></td></tr>`
}
function disciplineCard(item){return`<article class="card edital-discipline"><small>${safe(item.discipline)}</small><strong>${fmtNumber(item.items)} tópicos</strong><div class="edital-discipline-counts"><span>🔴 ${fmtNumber(item.critical)}</span><span>🟠 ${fmtNumber(item.attention)}</span><span>⚪ ${fmtNumber(item.noEvidence)}</span></div><p>${item.questionItems?`${fmtNumber(item.questionItems)} tópicos com bateria específica · ${fmtAccuracy(item.accuracy)}`:'Cobertura documental validada; aferição granular ainda parcial.'}</p></article>`}

try{
 const[data,home]=await Promise.all([loadJSON('data/edital-status.json'),loadJSON('data/home.json')]);
 setupShell('evolucao',home.meta||{});
 const summary=data.summary||{},coverage=summary.coverage||{},risk=summary.risk||{};
 const topics=(Array.isArray(data.topics)&&data.topics.length?data.topics:data.priorityTopics||[]).slice().sort(topicOrder);
 const fullCatalog=topics.length===Number(summary.total||0);
 const source=data.source||{};
 const disciplines=Array.isArray(data.disciplines)?data.disciplines:[];
 const current=home.latest||home.today||{};
 document.querySelector('main').innerHTML=`
 <section class="hero edital-hero"><span class="kicker">Edital vivo · Cargo 202</span><h1>O que já foi coberto — e onde ainda há risco</h1><p>Este painel separa três coisas que não devem ser confundidas: <strong>cobertura do edital</strong>, <strong>evidência objetiva de desempenho</strong> e <strong>risco residual</strong>. Estudado não significa dominado.</p><div class="hero-actions"><a class="btn primary" href="#topicos">Ver os ${fmtNumber(summary.total||topics.length)} tópicos</a><a class="btn" href="${safe(source.checkUrl)}" target="_blank" rel="noopener">Abrir análise no Notion ↗</a><a class="btn" href="${safe(source.url)}" target="_blank" rel="noopener">Abrir banco ↗</a></div></section>
 <section class="grid metrics edital-metrics">
  ${metric('Cobertura',`${fmtNumber((coverage.studied||0)+(coverage.review||0))}/${fmtNumber(summary.total||0)}`,summary.contentGaps?'Ainda existem lacunas reais':'0 lacunas de conteúdo identificadas')}
  ${metric('Críticos',fmtNumber(risk.critical||0),'Reincidência/erro com prioridade de revisão')}
  ${metric('Em atenção',fmtNumber(risk.attention||0),'Erro real sem criticidade acumulada')}
  ${metric('Sem aferição',fmtNumber(risk.no_evidence||0),'Estudados, mas sem medida tópica suficiente')}
  ${metric('Último PE',safe(current.pe||'—'),current.accuracy!=null?`${fmtAccuracy(current.accuracy)} · ${fmtNumber(current.acertos||0)}/${fmtNumber(current.attempted||current.meta||0)}`:'Sem resultado')}
 </section>
 <section class="section"><article class="card edital-reading"><div><span class="edital-reading-icon">🧭</span></div><div><h2>Leitura correta do painel</h2><p><strong>${fmtNumber(summary.total||0)} tópicos cobertos</strong> significa que houve passagem pelo conteúdo no ciclo. O diagnóstico atual identifica <strong>${fmtNumber(risk.critical||0)} críticos</strong> e <strong>${fmtNumber(risk.attention||0)} em atenção</strong> a partir do histórico real. Os <strong>${fmtNumber(risk.no_evidence||0)} sem aferição</strong> não são automaticamente fracos: apenas ainda não possuem evidência granular suficiente para uma nota tópica.</p><small>Gerado em ${fmtDate(data.generatedAt)} · fonte viva: Checklist do Edital — Cargo 202.</small></div></article></section>
 <section class="section"><div class="section-head"><div><h2>Raio-X por disciplina</h2><p>Distribuição dos riscos dentro das 82 unidades internas de controle.</p></div></div><div class="grid portal-grid edital-disciplines">${disciplines.map(disciplineCard).join('')}</div></section>
 <section class="section" id="topicos"><div class="section-head"><div><h2>Checklist completo do edital</h2><p>Pesquise e filtre por disciplina, bloco e nível de risco. A ordem inicial prioriza risco e prioridade do ciclo.</p></div><span class="stamp" id="result-count">${fmtNumber(topics.length)} itens</span></div>
 <div class="card edital-filters" role="search"><label>Pesquisar<input id="edital-search" type="search" placeholder="Ex.: crase, PAD, Cartão Gás…" autocomplete="off"></label><label>Disciplina<select id="edital-discipline"><option value="">Todas</option>${options(topics.map(x=>x.discipline))}</select></label><label>Raio-X<select id="edital-risk"><option value="">Todos</option>${Object.entries(riskMeta).filter(([key])=>key!=='unknown').map(([key,value])=>`<option value="${key}">${value.icon} ${value.label}</option>`).join('')}</select></label><label>Bloco<select id="edital-block"><option value="">Todos</option>${options(topics.map(x=>x.block))}</select></label><button class="btn" type="button" id="edital-clear">Limpar filtros</button></div>
 ${fullCatalog?'':`<article class="card alert" data-level="warning"><span class="alert-icon">△</span><div><b>Snapshot parcial</b><p>O resumo informa ${fmtNumber(summary.total||0)} itens, mas este arquivo trouxe ${fmtNumber(topics.length)} registros detalhados. O painel não inventará os itens ausentes.</p></div></article>`}
 <div class="table-wrap edital-table-wrap"><table class="edital-table"><thead><tr><th>Código</th><th>Tópico</th><th>Disciplina</th><th>Raio-X</th><th>Cobertura</th><th>Prioridade</th><th>Questões</th><th>Próxima ação</th><th>Fonte</th></tr></thead><tbody id="edital-body">${topics.map(topicRow).join('')}</tbody></table><div class="empty" id="edital-empty" hidden>Nenhum tópico corresponde aos filtros atuais.</div></div></section>
 <footer class="footer"><span>Edital vivo · Cargo 202</span><span>Snapshot <span data-snapshot></span> · última leitura do checklist ${fmtDate(source.lastEditedTime)}</span></footer>`;
 const search=document.querySelector('#edital-search'),discipline=document.querySelector('#edital-discipline'),riskFilter=document.querySelector('#edital-risk'),block=document.querySelector('#edital-block'),clear=document.querySelector('#edital-clear'),body=document.querySelector('#edital-body'),count=document.querySelector('#result-count'),empty=document.querySelector('#edital-empty');
 const params=new URLSearchParams(location.search);search.value=params.get('q')||'';discipline.value=params.get('discipline')||'';riskFilter.value=params.get('risk')||'';block.value=params.get('block')||'';
 function update(){const q=norm(search.value.trim()),d=discipline.value,r=riskFilter.value,b=block.value;const visible=topics.filter(item=>(!q||norm(`${item.code} ${item.topic} ${item.discipline} ${item.block} ${item.evidence} ${item.nextAction}`).includes(q))&&(!d||item.discipline===d)&&(!r||item.risk===r)&&(!b||item.block===b));body.innerHTML=visible.map(topicRow).join('');count.textContent=`${fmtNumber(visible.length)} de ${fmtNumber(topics.length)} itens`;empty.hidden=visible.length>0;const next=new URLSearchParams();if(search.value.trim())next.set('q',search.value.trim());if(d)next.set('discipline',d);if(r)next.set('risk',r);if(b)next.set('block',b);history.replaceState(null,'',`${location.pathname}${next.size?`?${next}`:''}${location.hash||''}`)}
 [search,discipline,riskFilter,block].forEach(control=>control.addEventListener(control===search?'input':'change',update));clear.addEventListener('click',()=>{search.value='';discipline.value='';riskFilter.value='';block.value='';update();search.focus()});update();
}catch(error){setLoadingError(error)}
