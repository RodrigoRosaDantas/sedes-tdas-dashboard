import{loadJSON,setupShell,fmtNumber,fmtPct,escapeHTML,setLoadingError}from'./common.js';
const BASE='/sedes-tdas-dashboard/';
try{
 const d=await loadJSON('data/subjects.json');
 setupShell('materias',d.meta);
 document.querySelector('main').innerHTML=`<section class="hero" data-subjects-root><span class="kicker">Biblioteca TDAS</span><h1>Matérias</h1><p>Consulte conteúdo, incidência e sinais de dificuldade por matéria. Use os dados para escolher onde praticar; a análise pedagógica acontece no ChatGPT.</p></section><section class="section"><div class="grid portal-grid">${d.subjects.map(s=>`<a class="card subject-card" href="${BASE}materias/${s.slug}/"><small>${fmtNumber(s.errors)} registros de erro · ${fmtPct(s.errors?s.high_critical/s.errors*100:0,1)} altos/críticos</small><b>${escapeHTML(s.subject)}</b><span>${fmtNumber(s.recurrent)} reincidências · ${fmtNumber(s.flashcards)} flashcards</span><em>Abrir matéria →</em></a>`).join('')}</div></section><footer class="footer"><span>Biblioteca TDAS · Matérias</span><span>Snapshot <span data-snapshot></span></span></footer>`;
}catch(e){setLoadingError(e)}
