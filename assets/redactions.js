import { loadJSON, setupShell, fmtDate, metric, escapeHTML, setLoadingError } from './common.js';

const score=value=>Number.isFinite(Number(value))?Number(value):null;
const fmtScore=value=>score(value)==null?'—':Number(value).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const statusTone=value=>/corrigid|reescrit/.test(norm(value))?'success':/risco|bloquead/.test(norm(value))?'danger':/andamento|estruturad|escrit/.test(norm(value))?'info':'warning';
const detailHref=rd=>`/sedes-tdas-dashboard/redacoes/detalhe/?rd=${encodeURIComponent(rd)}`;

function fallbackDashboard(data){
 const corrected=data.redactions.filter(item=>score(item.score)!=null&&score(item.score)>0);
 const values=corrected.map(item=>score(item.score));
 const average=values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
 return{summary:{total:data.redactions.length,corrected:corrected.length,pending:Math.max(0,data.redactions.length-corrected.length),average,median:null,best:corrected.length?[...corrected].sort((a,b)=>score(b.score)-score(a.score))[0]:null,worst:corrected.length?[...corrected].sort((a,b)=>score(a.score)-score(b.score))[0]:null,last:corrected.at(-1)||null,target:75,distanceToTarget:average==null?null:75-average,weeksRemaining:data.summary?.weeksRemaining||0,perWeek:data.summary?.perWeek||0,readiness:average||0},bands:{strong:values.filter(value=>value>=75).length,approvable:values.filter(value=>value>=50&&value<75).length,risk:values.filter(value=>value<50).length},criteria:{cac:null,ot:null,dlp:null},evolution:corrected.map(item=>({rd:item.rd,score:score(item.score),movingAverage3:null,theme:item.theme,axis:item.axis||''})),axes:[],failures:[],priorities:[],readiness:{value:average||0,label:'Em implantação',components:{},notice:'Índice interno de estudo.'}};
}

function evolutionChart(rows){
 if(!rows.length)return'<div class="empty">As notas aparecerão após a primeira correção exportada.</div>';
 const W=920,H=340,left=54,right=26,top=26,bottom=52;
 const values=rows.flatMap(item=>[score(item.score),score(item.movingAverage3)]).filter(Number.isFinite);
 const floor=Math.max(0,Math.floor((Math.min(...values,50)-6)/5)*5);
 const ceiling=Math.min(100,Math.max(80,Math.ceil((Math.max(...values,75)+6)/5)*5));
 const sx=index=>left+index*(W-left-right)/Math.max(1,rows.length-1);
 const sy=value=>H-bottom-(Number(value)-floor)*(H-top-bottom)/Math.max(1,ceiling-floor);
 const gridValues=[floor,50,60,75,ceiling].filter((value,index,array)=>value>=floor&&value<=ceiling&&array.indexOf(value)===index).sort((a,b)=>a-b);
 const grids=gridValues.map(value=>`<line x1="${left}" y1="${sy(value)}" x2="${W-right}" y2="${sy(value)}" class="rd-grid"/><text x="8" y="${sy(value)+4}" class="rd-axis-label">${value}</text>`).join('');
 const scorePoints=rows.map((item,index)=>`${sx(index)},${sy(item.score)}`).join(' ');
 const movingRows=rows.map((item,index)=>({item,index})).filter(({item})=>score(item.movingAverage3)!=null);
 const movingPoints=movingRows.map(({item,index})=>`${sx(index)},${sy(item.movingAverage3)}`).join(' ');
 const dots=rows.map((item,index)=>`<a href="${detailHref(item.rd)}"><circle cx="${sx(index)}" cy="${sy(item.score)}" r="5" class="rd-score-dot"><title>${escapeHTML(item.rd)}: ${fmtScore(item.score)} pontos · ${escapeHTML(item.theme||'')}</title></circle></a><text x="${sx(index)}" y="${H-20}" text-anchor="middle" class="rd-x-label">${escapeHTML(item.rd)}</text>`).join('');
 const latest=rows.at(-1);
 const summary=latest?`<p class="rd-chart-summary">Última nota: <strong>${fmtScore(latest.score)}</strong> · média de até 3 redações: <strong>${fmtScore(latest.movingAverage3)}</strong>.</p>`:'';
 return`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução das notas das redações"><title>Evolução das notas das redações</title>${grids}<line x1="${left}" y1="${sy(75)}" x2="${W-right}" y2="${sy(75)}" class="rd-target"><title>Meta de 75 pontos</title></line><polyline points="${scorePoints}" class="rd-score-line"/>${movingPoints?`<polyline points="${movingPoints}" class="rd-moving-line"/>`:''}${dots}</svg><div class="rd-chart-legend"><span><i class="legend-score"></i>Nota obtida</span><span><i class="legend-moving"></i>Média de até 3 redações</span><span><i class="legend-target"></i>Meta de 75</span></div>${summary}`;
}

function criteriaCards(criteria){
 const rows=[{label:'CAC',value:criteria.cac,detail:'Conteúdo e atendimento ao comando'},{label:'OT',value:criteria.ot,detail:'Organização textual'},{label:'DLP',value:criteria.dlp,detail:'Domínio da língua portuguesa'}];
 return rows.map(item=>{const width=item.value==null?0:Math.max(0,Math.min(100,item.value/3*100));return`<article class="card rd-criterion"><div><small>${item.label}</small><strong>${item.value==null?'—':Number(item.value).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}<em>/3</em></strong><span>${item.detail}</span></div><div class="rd-progress" aria-label="${item.label}: ${width.toFixed(0)}% da escala"><i style="width:${width}%"></i></div></article>`}).join('');
}
function distribution(bands){const rows=[['Forte',bands.strong||0,'75 ou mais'],['Aprovável',bands.approvable||0,'50 a 74,99'],['Risco',bands.risk||0,'abaixo de 50']];const max=Math.max(1,...rows.map(item=>item[1]));return rows.map(([label,value,detail])=>`<div class="rd-dist-row"><div><strong>${label}</strong><span>${detail}</span></div><div class="rd-dist-track"><i style="width:${Math.max(value?8:0,value/max*100)}%"></i></div><b>${value}</b></div>`).join('')}
function axesTable(rows){if(!rows?.length)return'<div class="empty">Os dados por eixo serão calculados na próxima sincronização discursiva.</div>';return`<div class="table-wrap"><table><thead><tr><th>Eixo</th><th>Total</th><th>Corrigidas</th><th>Pendentes</th><th>Média</th><th>Melhor</th></tr></thead><tbody>${rows.map(item=>`<tr><td>${escapeHTML(item.axis)}</td><td>${item.total}</td><td>${item.corrected}</td><td>${item.pending}</td><td>${fmtScore(item.average)}</td><td>${fmtScore(item.best)}</td></tr>`).join('')}</tbody></table></div>`}
function prioritiesList(rows){if(!rows?.length)return'<div class="empty">Nenhuma prioridade automática disponível.</div>';return`<div class="rd-priority-list">${rows.map((item,index)=>`<a class="card rd-priority" href="${item.href}"><span class="rd-priority-rank">${index+1}</span><div><strong>${escapeHTML(item.rd)} — ${escapeHTML(item.theme)}</strong><p>${escapeHTML(item.reasons.join(' · '))}</p><small>${escapeHTML(item.action)}</small></div><b>${fmtScore(item.score)}</b></a>`).join('')}</div>`}
function failureList(rows){if(!rows?.length)return'<div class="empty">Os padrões de erro aparecerão conforme as correções forem consolidadas.</div>';const max=Math.max(1,...rows.map(item=>item.count));return`<div class="rd-failures">${rows.slice(0,8).map(item=>`<div><span>${escapeHTML(item.label)}</span><div class="rd-failure-track"><i style="width:${item.count/max*100}%"></i></div><b>${item.count}</b></div>`).join('')}</div>`}
function readinessCard(readiness){const value=Number(readiness?.value||0);return`<article class="card rd-readiness"><div class="rd-ring" style="--value:${Math.max(0,Math.min(100,value))}"><strong>${value.toLocaleString('pt-BR',{maximumFractionDigits:1})}</strong><small>/100</small></div><div><span class="kicker">Prontidão Discursiva TDAS</span><h3>${escapeHTML(readiness?.label||'Em consolidação')}</h3><p>${escapeHTML(readiness?.notice||'Índice interno de acompanhamento.')}</p><div class="rd-components">${Object.entries(readiness?.components||{}).map(([key,val])=>`<span>${escapeHTML(({averageScore:'Média',recentTrend:'Tendência',command:'Comando',regularity:'Regularidade',rewrites:'Reescritas',languageReview:'Revisão linguística'})[key]||key)} <b>${Number(val).toLocaleString('pt-BR',{maximumFractionDigits:1})}</b></span>`).join('')}</div></div></article>`}
function csvDownload(rows){const header=['RD','Semana','PE','Data','Tema','Eixo','Status','Nota','Faixa','Prioridade'];const values=rows.map(item=>[item.rd,item.week,item.pe,item.date,item.theme,item.axis,item.status,item.score??'',item.classification,item.priority]);const csv=[header,...values].map(row=>row.map(value=>`"${String(value??'').replaceAll('"','""')}"`).join(';')).join('\n');const blob=new Blob([`\uFEFF${csv}`],{type:'text/csv;charset=utf-8'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='dashboard_discursivo_TDAS.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)}

function actionCard(priority){if(!priority)return'';return`<article class="card rd-next-action"><div><span class="kicker">Próxima ação recomendada</span><h2>${escapeHTML(priority.rd)} — ${escapeHTML(priority.theme)}</h2><p>${escapeHTML(priority.reasons.join(' · '))}</p><strong>${escapeHTML(priority.action)}</strong></div><a class="btn primary" href="${priority.href}">Abrir prioridade →</a></article>`}
function productionCards(rows){if(!rows.length)return'<div class="empty">Nenhuma proposta disponível neste momento.</div>';return`<div class="rd-card-list">${rows.map(item=>`<a class="card rd-bank-card" href="${detailHref(item.rd)}"><div class="rd-bank-card-top"><strong>${escapeHTML(item.rd)}</strong><span class="status ${statusTone(item.status)}">${escapeHTML(item.status)}</span></div><h3>${escapeHTML(item.theme)}</h3><p>${escapeHTML(item.axis||'Eixo não informado')} · ${item.pe?escapeHTML(item.pe):'PE não vinculado'} · ${fmtDate(item.date)}</p><b>${item.locked?`Liberação em ${fmtDate(item.date)}`:'Abrir proposta →'}</b></a>`).join('')}</div>`}
function bankCard(item){const access=item.locked?`Bloqueada até ${fmtDate(item.date)}`:item.corrected?'Correção disponível':'Proposta disponível';return`<a class="card rd-bank-card" href="${detailHref(item.rd)}"><div class="rd-bank-card-top"><strong>${escapeHTML(item.rd)}</strong><span class="status ${statusTone(item.status)}">${escapeHTML(item.status||'Não informado')}</span></div><h3>${escapeHTML(item.theme)}</h3><p>${escapeHTML(item.axis||'')} · Semana ${escapeHTML(item.week||'—')} · ${escapeHTML(item.pe||'PE não vinculado')}</p><div class="rd-bank-card-meta"><span>Nota <b>${fmtScore(item.score)}</b></span><span>${escapeHTML(item.classification||'Sem nota')}</span></div><small>${escapeHTML(access)} →</small></a>`}

try{
 const data=await loadJSON('data/redactions.json');
 setupShell('redacoes',data.meta);
 const dashboard=data.dashboard||fallbackDashboard(data);
 const summary=dashboard.summary;
 const latest=dashboard.evolution?.at(-1);
 const previous=dashboard.evolution?.at(-2);
 const variation=latest&&previous?score(latest.score)-score(previous.score):null;
 const available=data.redactions.filter(item=>!item.corrected&&!item.locked);
 const upcoming=data.redactions.filter(item=>item.locked);
 const defaultTab=new URLSearchParams(location.search).get('tab')||'overview';
 document.querySelector('main').innerHTML=`
  <section class="hero rd-hero"><div><span class="kicker">Preparação discursiva</span><h1>Dashboard Discursivo</h1><p>Transforme os dados do Banco Discursivo em ações objetivas de produção, reescrita e revisão.</p></div><div class="rd-hero-actions"><button class="btn" id="export-redactions">Baixar resumo</button><button class="btn secondary" data-tab-target="bank">Abrir banco</button></div></section>
  ${actionCard(dashboard.priorities?.[0])}
  <nav class="rd-tabs" role="tablist" aria-label="Áreas do Dashboard Discursivo">
   <button role="tab" data-tab="overview">Visão geral</button><button role="tab" data-tab="produce">Produzir</button><button role="tab" data-tab="rewrite">Reescrever</button><button role="tab" data-tab="bank">Banco</button>
  </nav>
  <div class="rd-tab-panel" data-panel="overview">
   <section class="grid metrics rd-metrics rd-primary-metrics">${metric('Média geral',fmtScore(summary.average),`meta ${fmtScore(summary.target)}`)}${metric('Tendência recente',variation==null?'—':`${variation>=0?'+':''}${fmtScore(variation)}`,variation==null?'aguardando comparação':variation>0?'subiu na última RD':variation<0?'caiu na última RD':'permaneceu estável')}${metric('Corrigidas',summary.corrected,`${summary.total} previstas`)}${metric('Pendentes',summary.pending,`${Number(summary.perWeek||0).toLocaleString('pt-BR',{maximumFractionDigits:1})} por semana`)}</section>
   <section class="section rd-two-columns"><article class="card panel rd-chart-card"><div class="section-head"><div><h2>Evolução das notas</h2><p>Escala dinâmica, nota obtida, média de até três redações e meta.</p></div></div><div class="rd-chart">${evolutionChart(dashboard.evolution||[])}</div></article>${readinessCard(dashboard.readiness)}</section>
   <section class="section"><div class="section-head"><div><h2>Evolução por critério</h2><p>Médias de CAC, OT e DLP na escala de 0 a 3.</p></div></div><div class="grid rd-criteria">${criteriaCards(dashboard.criteria||{})}</div></section>
   <section class="section rd-two-columns"><article class="card panel"><h2>Distribuição das notas</h2><p>Faixas internas utilizadas no acompanhamento.</p><div class="rd-distribution">${distribution(dashboard.bands||{})}</div>${summary.distanceToTarget==null?'':`<p class="rd-note">Distância da média atual até 75 pontos: <strong>${fmtScore(summary.distanceToTarget)}</strong>.</p>`}</article><article class="card panel"><h2>Padrões de erro</h2><p>Principais falhas registradas nas redações corrigidas.</p>${failureList(dashboard.failures)}</article></section>
   <section class="section"><div class="section-head"><div><h2>Desempenho por eixo</h2><p>Compare execução e notas entre os conteúdos do edital.</p></div></div>${axesTable(dashboard.axes)}</section>
  </div>
  <div class="rd-tab-panel" data-panel="produce">
   <section class="section"><div class="section-head"><div><h2>Propostas disponíveis</h2><p>Redações já liberadas para produção.</p></div><span class="stamp">${available.length} disponíveis</span></div>${productionCards(available)}</section>
   <section class="section"><div class="section-head"><div><h2>Próximas liberações</h2><p>Temas protegidos para preservar a aplicação cega.</p></div><span class="stamp">${upcoming.length} futuras</span></div>${productionCards(upcoming)}</section>
  </div>
  <div class="rd-tab-panel" data-panel="rewrite"><section class="section"><div class="section-head"><div><h2>Fila estratégica de reescrita</h2><p>Prioridades calculadas por nota, núcleo do edital, reescrita e revisão linguística.</p></div></div>${prioritiesList(dashboard.priorities)}</section></div>
  <div class="rd-tab-panel" data-panel="bank">
   <section class="section" id="banco"><div class="section-head"><div><h2>Banco Discursivo</h2><p>Status real, nota e acesso individual de RD01 até a última.</p></div><div class="rd-bank-actions"><span id="result-count" class="stamp"></span><button class="btn secondary" id="clear-filters">Limpar filtros</button></div></div>
    <div class="toolbar rd-toolbar"><label>Pesquisar<input id="search" type="search" placeholder="RD, tema, PE ou eixo"></label><label>Status<select id="status"><option value="all">Todos</option></select></label><label>Eixo<select id="axis"><option value="all">Todos</option></select></label><label>Semana<select id="week"><option value="all">Todas</option></select></label><label>Faixa<select id="band"><option value="all">Todas</option><option>Forte</option><option>Aprovável</option><option>Risco</option><option value="Sem nota">Sem nota</option></select></label><label>Ação<select id="action-filter"><option value="all">Todas</option><option value="rewrite">Necessita reescrita</option><option value="available">Disponível agora</option><option value="locked">Futura bloqueada</option></select></label><label>Ordenar<select id="sort"><option value="rd">RD</option><option value="date">Data</option><option value="score-asc">Menor nota</option><option value="score-desc">Maior nota</option><option value="priority">Prioridade</option></select></label></div>
    <div class="table-wrap rd-bank-table"><table><thead><tr><th>RD</th><th>Semana</th><th>PE</th><th>Data</th><th>Tema</th><th>Status</th><th>Nota</th><th>Acesso</th></tr></thead><tbody id="rows"></tbody></table></div><div id="cards" class="rd-bank-cards"></div>
   </section>
  </div>
  <section class="section"><article class="card panel rd-privacy"><h3>Privacidade e aplicação cega</h3><p>${escapeHTML(data.privacy?.notice||data.notice||'Conteúdos futuros permanecem protegidos.')}</p><p>Links diretos do banco editorial não são exibidos na interface pública. O histórico pessoal ainda depende da camada pública atual e será migrável para autenticação privada em etapa própria.</p></article></section>
  <footer class="footer"><span>Dashboard Discursivo · banco oficial</span><span>Snapshot <span data-snapshot></span> · última atualização <span data-last-sync></span></span></footer>`;

 const tabButtons=[...document.querySelectorAll('[data-tab]')];
 const panels=[...document.querySelectorAll('[data-panel]')];
 function activateTab(name,{replace=false}={}){const valid=tabButtons.some(button=>button.dataset.tab===name)?name:'overview';tabButtons.forEach(button=>{const active=button.dataset.tab===valid;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1});panels.forEach(panel=>panel.hidden=panel.dataset.panel!==valid);const params=new URLSearchParams(location.search);params.set('tab',valid);const url=`${location.pathname}?${params.toString()}${location.hash}`;(replace?history.replaceState:history.pushState).call(history,{tab:valid},'',url)}
 tabButtons.forEach(button=>button.addEventListener('click',()=>activateTab(button.dataset.tab)));
 document.querySelectorAll('[data-tab-target]').forEach(button=>button.addEventListener('click',()=>activateTab(button.dataset.tabTarget)));
 window.addEventListener('popstate',()=>activateTab(new URLSearchParams(location.search).get('tab')||'overview',{replace:true}));
 activateTab(defaultTab,{replace:true});

 const rows=document.querySelector('#rows'),cards=document.querySelector('#cards'),search=document.querySelector('#search'),status=document.querySelector('#status'),axis=document.querySelector('#axis'),week=document.querySelector('#week'),band=document.querySelector('#band'),actionFilter=document.querySelector('#action-filter'),sort=document.querySelector('#sort'),count=document.querySelector('#result-count');
 const unique=key=>[...new Set(data.redactions.map(item=>item[key]).filter(value=>value!==''&&value!=null))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));
 status.insertAdjacentHTML('beforeend',unique('status').map(value=>`<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join(''));
 axis.insertAdjacentHTML('beforeend',unique('axis').map(value=>`<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join(''));
 week.insertAdjacentHTML('beforeend',unique('week').map(value=>`<option value="${escapeHTML(value)}">Semana ${escapeHTML(value)}</option>`).join(''));
 const filterControls={q:search,status,axis,week,band,action:actionFilter,sort};
 const currentParams=new URLSearchParams(location.search);
 for(const[key,control]of Object.entries(filterControls)){const value=currentParams.get(key);if((value&&[...(control.options||[])].some(option=>option.value===value))||control===search)control.value=value||control.value}
 const focus=[currentParams.get('rd'),currentParams.get('pe')].filter(Boolean).join(' ').trim();if(focus&&!search.value)search.value=focus;
 function syncFilters(){const params=new URLSearchParams(location.search);for(const[key,control]of Object.entries(filterControls)){const value=control.value.trim();if(value&&value!=='all'&&!(key==='sort'&&value==='rd'))params.set(key,value);else params.delete(key)}history.replaceState({},'',`${location.pathname}?${params.toString()}${location.hash}`)}
 function render(){const q=norm(search.value).trim();let filtered=data.redactions.filter(item=>(status.value==='all'||item.status===status.value)&&(axis.value==='all'||item.axis===axis.value)&&(week.value==='all'||String(item.week)===week.value)&&(band.value==='all'||(item.classification||'Sem nota')===band.value)&&(actionFilter.value==='all'||actionFilter.value==='rewrite'&&Boolean(item.rewriteRequired||item.corrected&&item.nextAction)||actionFilter.value==='available'&&Boolean(!item.corrected&&!item.locked)||actionFilter.value==='locked'&&Boolean(item.locked))&&(!q||norm([item.rd,item.pe,item.theme,item.axis,item.status,item.mainFailure,item.nextAction].join(' ')).includes(q)));
  const byPriority=item=>{const index=dashboard.priorities?.findIndex(priority=>priority.rd===item.rd)??-1;return index<0?999:index};
  filtered=[...filtered].sort((a,b)=>sort.value==='date'?String(a.date).localeCompare(String(b.date)):sort.value==='score-asc'?(score(a.score)??999)-(score(b.score)??999):sort.value==='score-desc'?(score(b.score)??-1)-(score(a.score)??-1):sort.value==='priority'?byPriority(a)-byPriority(b):String(a.rd).localeCompare(String(b.rd),undefined,{numeric:true}));
  count.textContent=`${filtered.length} de ${data.redactions.length}`;
  rows.innerHTML=filtered.map(item=>{const href=detailHref(item.rd);const access=item.locked?`Bloqueada até ${fmtDate(item.date)}`:item.corrected?'Correção disponível':'Proposta disponível';return`<tr${focus&&norm([item.rd,item.pe].join(' ')).includes(norm(focus))?' data-focused-redaction="true"':''}><td><a class="rd-code" href="${href}">${escapeHTML(item.rd)}</a></td><td>${escapeHTML(item.week)}</td><td>${escapeHTML(item.pe||'—')}</td><td>${fmtDate(item.date)}</td><td><a href="${href}">${escapeHTML(item.theme)}</a><small class="rd-table-axis">${escapeHTML(item.axis||'')}</small></td><td><span class="status ${statusTone(item.status)}">${escapeHTML(item.status||'Não informado')}</span></td><td><strong>${fmtScore(item.score)}</strong><small class="rd-classification">${escapeHTML(item.classification||'Sem nota')}</small></td><td><a class="rd-access ${item.locked?'locked':''}" href="${href}">${escapeHTML(access)} →</a></td></tr>`}).join('')||'<tr><td colspan="8" class="empty">Nenhuma redação encontrada.</td></tr>';
  cards.innerHTML=filtered.map(bankCard).join('')||'<div class="empty">Nenhuma redação encontrada.</div>';syncFilters();
 }
 Object.values(filterControls).forEach(control=>control.addEventListener(control===search?'input':'change',render));
 document.querySelector('#clear-filters').onclick=()=>{search.value='';status.value=axis.value=week.value=band.value=actionFilter.value='all';sort.value='rd';render()};
 document.querySelector('#export-redactions').onclick=()=>csvDownload(data.redactions);
 render();
}catch(error){setLoadingError(error)}
