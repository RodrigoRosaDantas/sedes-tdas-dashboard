import{loadJSON,setupShell,fmtPct,fmtNumber,fmtDate,metric,renderLineChart,renderBars,escapeHTML,setLoadingError}from'./common.js?v=25';

const DAY=86400000;
const isoUTC=iso=>{const[y,m,d]=iso.split('-').map(Number);return Date.UTC(y,m-1,d)};
const diffDays=(start,end)=>Math.floor((isoUTC(end)-isoUTC(start))/DAY);
const addDays=(iso,days)=>new Date(isoUTC(iso)+days*DAY).toISOString().slice(0,10);
const peNumber=pe=>Number(String(pe||'').replace(/\D/g,''))||0;

function diagnosis(balance,rate){
 if(balance>0)return{label:'Adiantado',level:'info',detail:`Execução ${balance} ${balance===1?'dia':'dias'} acima do planejado. Preserve o ritmo sem antecipar blocos de baixo retorno.`};
 if(balance===0)return{label:'No ritmo',level:'info',detail:'O ciclo executado acompanha exatamente o planejamento até o corte atual.'};
 const delay=Math.abs(balance);
 if(delay<=2)return{label:'Atraso leve',level:'warning',detail:`Diferença de ${delay} ${delay===1?'dia':'dias'}. É possível recuperar com ajuste curto, sem redesenhar o ciclo.`};
 if(delay<=5)return{label:'Atraso moderado',level:'warning',detail:`Diferença de ${delay} dias. Priorize os PE essenciais e proteja simulados e redações.`};
 return{label:'Atraso crítico',level:'critical',detail:`Diferença de ${delay} dias e cumprimento de ${rate.toFixed(1).replace('.',',')}%. É necessária correção de rota imediata.`};
}

function renderPlanChart(el,{total,plannedToDate,completed,startDate,snapshotDate,examDate}){
 const W=900,H=330,px=54,py=42;
 const x=day=>px+(Math.max(1,day)-1)*(W-2*px)/Math.max(1,total-1);
 const y=value=>H-py-Number(value)*(H-2*py)/Math.max(1,total);
 const planned=Array.from({length:total},(_,i)=>`${x(i+1)},${y(i+1)}`).join(' ');
 const executed=Array.from({length:plannedToDate},(_,i)=>`${x(i+1)},${y(Math.min(i+1,completed))}`).join(' ');
 const levels=[0,Math.round(total/4),Math.round(total/2),Math.round(total*3/4),total];
 const grids=levels.map(v=>`<line x1="${px}" y1="${y(v)}" x2="${W-px}" y2="${y(v)}" stroke="var(--line)"/><text x="8" y="${y(v)+4}" fill="var(--muted)" font-size="12">${v} PE</text>`).join('');
 const currentX=x(plannedToDate),currentY=y(completed);
 el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Curva acumulada de dias planejados e cumpridos"><title>Planejado x cumprido no ciclo</title>${grids}<polyline fill="none" stroke="var(--muted)" stroke-width="3" stroke-dasharray="9 7" points="${planned}"/><polyline fill="none" stroke="var(--accent)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" points="${executed}"/><line x1="${currentX}" y1="${py}" x2="${currentX}" y2="${H-py}" stroke="var(--line)" stroke-dasharray="4 5"/><circle cx="${currentX}" cy="${currentY}" r="6" fill="var(--green)"><title>Corte: ${completed}/${plannedToDate}</title></circle><text x="${px}" y="${H-10}" fill="var(--muted)" font-size="12">${fmtDate(startDate)}</text><text x="${Math.max(px,currentX-40)}" y="${H-10}" fill="var(--muted)" font-size="12">corte ${fmtDate(snapshotDate)}</text><text x="${W-px-70}" y="${H-10}" fill="var(--muted)" font-size="12">${fmtDate(examDate)}</text></svg><div class="chart-summary"><span><b style="color:var(--muted)">− −</b> Planejado acumulado</span> · <span><b style="color:var(--accent)">━━</b> Cumprido acumulado</span> · o descanso planejado também conta como PE cumprido.</div>`;
}

try{
 const[d,home]=await Promise.all([loadJSON('data/evolution.json'),loadJSON('data/home.json')]);
 setupShell('evolucao',{...d.meta,version:'25.0'});
 const startDate=(d.actual.find(x=>x.pe==='PE01')||d.actual[0]).date;
 const snapshotDate=d.meta.snapshotDate;
 const examDate=d.meta.examDate;
 const total=Number(home.metrics.totalPE||112);
 const plannedToDate=Math.min(total,Math.max(0,diffDays(startDate,snapshotDate)+1));
 const completed=Number(home.metrics.completed||Math.max(...d.actual.map(x=>peNumber(x.pe))));
 const studyDays=d.weekly.reduce((sum,w)=>sum+Number(w.completed||0),0);
 const restDays=Math.max(0,completed-studyDays);
 const balance=completed-plannedToDate;
 const compliance=plannedToDate?completed/plannedToDate*100:0;
 const remaining=Math.max(0,total-completed);
 const operationalDays=Math.max(1,diffDays(snapshotDate,examDate));
 const neededPace=remaining/operationalDays;
 const recentWindow=Math.min(7,plannedToDate);
 const completedBeforeWindow=Math.max(0,Math.min(completed,plannedToDate-recentWindow));
 const recentCompleted=Math.max(0,completed-completedBeforeWindow);
 const recentPace=recentWindow?recentCompleted/recentWindow:0;
 const projectedFinish=recentPace>0?addDays(snapshotDate,Math.ceil(remaining/recentPace)):null;
 const onTime=projectedFinish&&isoUTC(projectedFinish)<=isoUTC(examDate);
 const diag=diagnosis(balance,compliance);
 const currentWeek=Math.ceil(plannedToDate/7);
 const weeklyPlan=Array.from({length:currentWeek},(_,index)=>{
  const week=index+1;
  const planned=Math.min(7,Math.max(0,plannedToDate-index*7));
  const fulfilled=Math.min(7,Math.max(0,completed-index*7));
  const source=d.weekly.find(x=>Number(x.week)===week);
  const studied=Math.min(fulfilled,Number(source?.completed||0));
  const rests=Math.max(0,fulfilled-studied);
  const rate=planned?fulfilled/planned*100:0;
  const status=fulfilled>planned?'Adiantado':fulfilled===planned?'No ritmo':planned-fulfilled<=2?'Atraso leve':planned-fulfilled<=5?'Atraso moderado':'Atraso crítico';
  return{week,planned,fulfilled,studied,rests,rate,status};
 });
 const bestBlock=d.blocks.slice().sort((a,b)=>b.accuracy-a.accuracy)[0];
 const completedSimulations=d.simulations.filter(x=>x.status==='Concluído'&&/^Simulado/i.test(x.title)).length;
 document.querySelector('main').innerHTML=`
 <section class="hero"><span class="kicker">Desempenho e governança do ciclo</span><h1>Evolução</h1><p>Compare qualidade, volume e aderência ao planejamento para saber se o estudo está avançando no ritmo necessário.</p></section>
 <section class="section" id="planejado-executado">
  <div class="section-head"><div><h2>Planejado x cumprido</h2><p>O progresso do ciclo inclui estudo, execução e descansos planejados já cumpridos.</p></div><span class="stamp">Corte ${fmtDate(snapshotDate)}</span></div>
  <div class="grid metrics">
   ${metric('Planejados até hoje',`${plannedToDate}/${total}`,'PE previstos no calendário até o corte')}
   ${metric('Dias cumpridos',`${completed}/${total}`,`${studyDays} de estudo/execução + ${restDays} descansos`)}
   ${metric('Saldo do plano',balance===0?'0 dia':`${balance>0?'+':''}${balance} ${Math.abs(balance)===1?'dia':'dias'}`,diag.label)}
   ${metric('Cumprimento',fmtPct(compliance,1),`${completed} cumpridos ÷ ${plannedToDate} planejados`)}
  </div>
  <div class="grid two">
   <article class="card chart" id="plan-chart"></article>
   <div class="grid">
    <article class="card alert" data-level="${diag.level}"><span class="alert-icon">${diag.level==='critical'?'!':diag.level==='warning'?'△':'✓'}</span><div><b>${diag.label}</b><p>${escapeHTML(diag.detail)}</p></div></article>
    <article class="card formula"><small>Ritmo necessário</small><strong>${neededPace.toFixed(2).replace('.',',')} PE/dia</strong><code>${remaining} PE restantes ÷ ${operationalDays} dias até a prova</code></article>
    <article class="card formula"><small>Ritmo dos últimos ${recentWindow} dias</small><strong>${recentPace.toFixed(2).replace('.',',')} PE/dia</strong><code>${recentCompleted} PE cumpridos ÷ ${recentWindow} dias do calendário</code></article>
    <article class="card formula"><small>Projeção de fechamento</small><strong>${projectedFinish?fmtDate(projectedFinish):'Sem ritmo calculável'}</strong><code>${projectedFinish?(onTime?'Conclusão projetada dentro do prazo.':'Conclusão projetada após a prova.'):'Ainda não há execução recente suficiente.'}</code></article>
   </div>
  </div>
 </section>
 <section class="section"><div class="section-head"><div><h2>Cumprimento semanal do plano</h2><p>Estudo e descanso aparecem separados, mas ambos compõem o total de PE cumpridos.</p></div></div><div class="table-wrap"><table><thead><tr><th>Semana</th><th>Planejados até o corte</th><th>Cumpridos</th><th>Estudo/execução</th><th>Descansos</th><th>Cumprimento</th><th>Situação</th></tr></thead><tbody>${weeklyPlan.map(x=>`<tr><td>Semana ${x.week}</td><td>${x.planned}</td><td>${x.fulfilled}</td><td>${x.studied}</td><td>${x.rests}</td><td>${fmtPct(x.rate,1)}</td><td><span class="status ${x.status.includes('crítico')?'critical':x.status.includes('Atraso')?'warning':''}">${x.status}</span></td></tr>`).join('')}</tbody></table></div></section>
 <section class="grid metrics">${metric('Histórico',fmtPct(d.summary.historical),`${d.summary.resultDays} dias com resultado`)}${metric('Últimas 4 semanas',fmtPct(d.summary.recent4),`${d.summary.trend>=0?'+':''}${d.summary.trend.toFixed(2).replace('.',',')} p.p.`)}${metric('Melhor bloco',bestBlock.block,fmtPct(bestBlock.accuracy))}${metric('Simulados consolidados',completedSimulations,'etapas objetivas principais concluídas')}</section>
 <section class="section"><div class="section-head"><div><h2>Evolução diária do aproveitamento</h2><p>O gráfico usa somente PE com resultado preenchido.</p></div></div><div class="toolbar"><label>Período<select id="period"><option value="7">Últimos 7</option><option value="15">Últimos 15</option><option value="30">Últimos 30</option><option value="all" selected>Ciclo completo</option></select></label><label>Bloco<select id="block"><option value="all">Todos</option>${[...new Set(d.actual.map(x=>x.block))].map(x=>`<option>${escapeHTML(x)}</option>`).join('')}</select></label></div><article class="card chart" id="daily-chart"></article></section>
 <section class="section grid two"><article class="card panel"><h3>Aproveitamento semanal</h3><div id="weekly-bars"></div></article><article class="card panel"><h3>Volume semanal</h3><div id="volume-bars"></div></article></section>
 <section class="section"><div class="section-head"><div><h2>Desempenho por bloco</h2><p>Comparação entre volume, acertos e taxa.</p></div></div><div class="table-wrap"><table><thead><tr><th>Bloco</th><th>Dias</th><th>Questões</th><th>Acertos</th><th>Aproveitamento</th></tr></thead><tbody>${d.blocks.map(x=>`<tr><td>${escapeHTML(x.block)}</td><td>${x.days}</td><td>${fmtNumber(x.meta)}</td><td>${fmtNumber(x.correct)}</td><td>${fmtPct(x.accuracy)}</td></tr>`).join('')}</tbody></table></div></section>
 <section class="section"><div class="section-head"><div><h2>Simulados</h2><p>Histórico e próximos marcos do planejamento.</p></div></div><div class="table-wrap"><table><thead><tr><th>ID</th><th>Data</th><th>Simulado</th><th>Resultado</th><th>Status</th></tr></thead><tbody>${d.simulations.map(x=>`<tr><td>${escapeHTML(x.id)}</td><td>${escapeHTML(x.date)}</td><td>${x.url?`<a href="${x.url}" target="_blank" rel="noopener">${escapeHTML(x.title)} ↗</a>`:escapeHTML(x.title)}</td><td>${escapeHTML(x.result)} · ${escapeHTML(x.score)}</td><td>${escapeHTML(x.status)}</td></tr>`).join('')}</tbody></table></div></section>
 <footer class="footer"><span>Evolução · planejado x cumprido</span><span>Snapshot <span data-snapshot></span></span></footer>`;

 renderPlanChart(document.querySelector('#plan-chart'),{total,plannedToDate,completed,startDate,snapshotDate,examDate});
 const chart=document.querySelector('#daily-chart'),period=document.querySelector('#period'),block=document.querySelector('#block');
 function update(){let rows=d.actual.filter(x=>block.value==='all'||x.block===block.value);if(period.value!=='all')rows=rows.slice(-Number(period.value));renderLineChart(chart,rows,{label:'Aproveitamento por PE'})}
 period.onchange=block.onchange=update;update();
 renderBars(document.querySelector('#weekly-bars'),d.weekly.map(x=>({label:'Semana '+x.week,value:x.accuracy})),{labelKey:'label',valueKey:'value',suffix:'%',maxValue:100});
 renderBars(document.querySelector('#volume-bars'),d.weekly.map(x=>({label:'Semana '+x.week,value:x.meta_completed})),{labelKey:'label',valueKey:'value'});
}catch(e){setLoadingError(e)}
