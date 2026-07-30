import{loadJSON,setupShell,fmtNumber,fmtDate,escapeHTML,metric,setLoadingError}from'./common.js?v=23';
const BASE='/sedes-tdas-dashboard/';
const CADERNO='https://app.notion.com/p/fabd0f60bdb84327bd83d99dc9a40374?v=575d735c37e647508dcc3e944ea56f1e';
const peHref=id=>BASE+'pe/'+Number(String(id).replace(/\D/g,''))+'/';
const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const summaryHTML=s=>escapeHTML(String(s??'').replace(/<br\s*\/?>/gi,'\n')).replace(/\n/g,'<br>');
const badge=(text,kind='')=>`<span class="error-badge ${kind}">${escapeHTML(text)}</span>`;
try{
 const[home,risks,subjects,index]=await Promise.all([
  loadJSON('data/home.json'),loadJSON('data/risks.json'),loadJSON('data/subjects.json'),loadJSON('data/error-questions-v23.json')
 ]);
 const parts=await Promise.all(index.parts.map(loadJSON));
 setupShell('riscos',home.meta);
 const total=risks.summary.total;
 const recurrent=risks.summary.recurrent;
 const highCritical=risks.summary.high+risks.summary.critical;
 const rows=parts.flat();
 let limit=6;
 document.querySelector('main').innerHTML=`
 <section class="hero">
  <span class="kicker">Revisão ativa · Plataforma v${escapeHTML(home.meta.version)}</span>
  <h1>Questões que errei</h1>
  <p>Enunciado, alternativa marcada, gabarito, diagnóstico, macete, lógica correta, pegadinha e regra de ouro — diretamente no site.</p>
  <div class="detail-actions"><a class="btn primary" href="#questoes">Abrir explicações</a><a class="btn" href="${CADERNO}" target="_blank" rel="noopener">Auditar no Notion ↗</a></div>
 </section>
 <section class="grid metrics">
  ${metric('Questões catalogadas',fmtNumber(total),'todos os registros reais do Caderno de Erros')}
  ${metric('Explicações completas',fmtNumber(rows.length),'registros recentes validados individualmente')}
  ${metric('Reincidentes',fmtNumber(recurrent),'erros que já reapareceram')}
  ${metric('Altos ou críticos',fmtNumber(highCritical),'prioridade de revisão')}
 </section>
 <section class="section">
  <div class="quality-note"><b>Publicação ampliada.</b> O catálogo e os diagnósticos por matéria representam os ${fmtNumber(total)} registros. Nesta versão, ${fmtNumber(rows.length)} registros recentes estão publicados com o campo Resumo integral; os demais continuam acessíveis pelo Caderno de Erros enquanto são incorporados em lotes validados.</div>
 </section>
 <section class="section" id="questoes">
  <div class="section-head"><div><h2>Explicações por matéria</h2><p>Pesquise o enunciado ou filtre por matéria, gravidade e reincidência.</p></div><span class="stamp" id="result-count"></span></div>
  <div class="error-toolbar">
   <label><span>Pesquisar</span><input id="error-search" type="search" placeholder="Tema, questão, alternativa ou macete"></label>
   <label><span>Matéria</span><select id="subject-filter"><option value="">Todas</option>${[...new Set(rows.map(x=>x.subject))].sort().map(x=>`<option>${escapeHTML(x)}</option>`).join('')}</select></label>
   <label><span>Gravidade</span><select id="severity-filter"><option value="">Todas</option><option>Média</option><option>Alta</option><option>Crítica</option></select></label>
   <label><span>Reincidência</span><select id="recurrence-filter"><option value="">Todas</option><option value="yes">Reincidentes</option><option value="no">Sem reincidência</option></select></label>
  </div>
  <div id="error-groups"></div>
  <div class="load-more-wrap"><button class="btn" id="load-more" type="button">Carregar mais explicações</button></div>
 </section>
 <section class="section">
  <div class="section-head"><div><h2>Diagnóstico consolidado</h2><p>Abra a página de cada matéria para ver padrões dominantes, linha temporal e recomendação.</p></div><a class="btn" href="${BASE}materias/">Todas as matérias</a></div>
  <div class="grid portal-grid">${subjects.subjects.map(s=>`<a class="card subject-card" href="${BASE}materias/${s.slug}/"><small>${fmtNumber(s.errors)} erros · ${fmtNumber(s.recurrent)} reincidentes</small><b>${escapeHTML(s.subject)}</b><span>${fmtNumber(s.high_critical)} altos/críticos · ${fmtNumber(s.flashcards)} flashcards</span><em>Abrir diagnóstico →</em></a>`).join('')}</div>
 </section>
 <footer class="footer"><span>Questões erradas · Plataforma v${escapeHTML(home.meta.version)}</span><span>Snapshot <span data-snapshot></span></span></footer>`;
 const search=document.querySelector('#error-search');
 const subject=document.querySelector('#subject-filter');
 const severity=document.querySelector('#severity-filter');
 const recurrence=document.querySelector('#recurrence-filter');
 const groups=document.querySelector('#error-groups');
 const count=document.querySelector('#result-count');
 const more=document.querySelector('#load-more');
 const match=x=>{
  const q=normalize(search.value);
  const hay=normalize([x.title,x.subject,x.origin,x.theme,x.subtheme,x.summary,(x.patterns||[]).join(' ')].join(' '));
  return(!q||hay.includes(q))
   &&(!subject.value||x.subject===subject.value)
   &&(!severity.value||x.severity===severity.value)
   &&(!recurrence.value||(recurrence.value==='yes'?Number(x.recurrence)>0:Number(x.recurrence)===0));
 };
 const card=x=>`<details class="error-entry">
  <summary>
   <span class="error-summary-main"><small>${escapeHTML(x.origin)} · ${fmtDate(x.date)}</small><strong>${escapeHTML(x.title)}</strong><span>${escapeHTML(x.subject)} · ${escapeHTML(x.theme||'Tema não informado')}</span></span>
   <span class="error-summary-tags">${badge(x.severity,'severity-'+normalize(x.severity))}${Number(x.recurrence)>0?badge(x.recurrence+' reincidência'+(Number(x.recurrence)===1?'':'s'),'recurrent'):badge('erro novo')}</span>
  </summary>
  <div class="error-entry-body">
   <div class="error-meta">
    ${badge(x.subject)}${badge(x.theme||'Tema não informado')}${x.subtheme?badge(x.subtheme):''}
    ${(x.patterns||[]).map(p=>badge(p,'pattern')).join('')}
    ${badge(x.flashcard?'Flashcard ativo':'Sem flashcard',x.flashcard?'ok':'')}
    ${badge(x.reviewed?'Revisado':'Revisão pendente',x.reviewed?'ok':'warning')}
   </div>
   <div class="error-explanation">${x.summary?summaryHTML(x.summary):'<p class="quality-note">O registro não possui explicação completa no Notion.</p>'}</div>
   <div class="detail-actions"><a class="btn" href="${peHref(x.origin)}">Abrir ${escapeHTML(x.origin)}</a><a class="btn" href="${x.url}" target="_blank" rel="noopener">Auditar registro ↗</a></div>
  </div>
 </details>`;
 const render=()=>{
  const filtered=rows.filter(match);
  const visible=filtered.slice(0,limit);
  const grouped=visible.reduce((acc,x)=>{(acc[x.subject]??=[]).push(x);return acc},{});
  groups.innerHTML=Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b,'pt-BR')).map(([name,items])=>`
   <section class="error-subject-group"><div class="error-group-head"><h3>${escapeHTML(name)}</h3><span>${items.length} exibida${items.length===1?'':'s'}</span></div>${items.map(card).join('')}</section>`).join('')||'<div class="empty">Nenhuma questão corresponde aos filtros.</div>';
  count.textContent=filtered.length+' resultado'+(filtered.length===1?'':'s');
  more.hidden=visible.length>=filtered.length;
 };
 [search,subject,severity,recurrence].forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{limit=6;render()}));
 more.addEventListener('click',()=>{limit+=6;render()});
 render();
}catch(e){setLoadingError(e)}