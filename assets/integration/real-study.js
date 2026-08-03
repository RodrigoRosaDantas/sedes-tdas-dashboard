import {BASE, loadJSON, setupShell, fmtNumber, fmtPct, fmtDate, metric, escapeHTML, setLoadingError, routes} from '../common.js?v=24.1';

try {
  const [home, today, more] = await Promise.all([
    loadJSON('data/home.json'),
    loadJSON('data/today.json'),
    loadJSON('data/more.json'),
  ]);

  setupShell('hoje', home.meta);
  const current = today.current;
  const cumulativeQuestions = home.metrics?.resultQuestions ?? home.metrics?.questions ?? 0;
  const cumulativeCorrect = home.metrics?.correct ?? 0;
  const cumulativeAccuracy = home.metrics?.accuracy ?? 0;
  const pePath = `${BASE}pe/${current.number}/`;
  const result = current.attempted ? `${current.acertos}/${current.attempted}` : 'Sem resultado';
  const sources = more.meta?.sources || home.meta?.sources || [];

  document.querySelector('main').innerHTML = `
    <section class="hero">
      <span class="kicker">Operação real · bancos oficiais do TDAS</span>
      <h1>Central de estudo</h1>
      <p>Use esta página para acompanhar o ciclo, abrir o registro correto no Notion e consultar evolução, redações e caderno de erros já sincronizados.</p>
      <div class="tags">
        <span class="tag">Snapshot ${fmtDate(home.meta.snapshotDate)}</span>
        <span class="tag">${escapeHTML(current.pe)} · ${escapeHTML(current.status)}</span>
        <span class="tag">Somente leitura no site</span>
      </div>
      <div class="hero-actions">
        <a class="btn primary" href="${current.url}" target="_blank" rel="noopener">Abrir registro no Notion ↗</a>
        <a class="btn" href="${pePath}">Ver detalhamento do PE</a>
        <a class="btn" href="${routes.agenda}">Abrir agenda</a>
      </div>
    </section>

    <section class="grid metrics">
      ${metric('PE atual', current.pe, `${fmtDate(current.date)} · ${current.title}`)}
      ${metric('Resultado do PE', result, `${current.qg ?? 0} gerais · ${current.qe ?? 0} específicas`)}
      ${metric('Questões acumuladas', fmtNumber(cumulativeQuestions), `${fmtNumber(cumulativeCorrect)} acertos registrados`)}
      ${metric('Aproveitamento geral', fmtPct(cumulativeAccuracy), 'calculado somente com resultados lançados')}
    </section>

    <section class="section">
      <div class="section-head"><div><h2>Fluxo de uso real</h2><p>O Notion registra a execução; o site consolida e apresenta o snapshot validado.</p></div><span class="stamp">Notion → GitHub → Site</span></div>
      <div class="grid three">
        <article class="card panel"><small>1. Executar</small><h3>Estude pelo material do dia</h3><p>Abra o PE no Notion, realize a atividade e registre o resultado no banco oficial de controle.</p></article>
        <article class="card panel"><small>2. Corrigir</small><h3>Registre erros e redações</h3><p>Use os bancos oficiais do Caderno de Erros e de Redações, preservando os protocolos vigentes.</p></article>
        <article class="card panel"><small>3. Acompanhar</small><h3>Consulte o painel sincronizado</h3><p>Após a sincronização, confira evolução, riscos, agenda e redações sem duplicar lançamentos.</p></article>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><div><h2>Áreas operacionais</h2><p>Todos os atalhos abaixo usam exclusivamente os dados reais do TDAS.</p></div></div>
      <div class="grid portal-grid">
        <a class="card portal" href="${routes.hoje}"><small>Execução</small><b>Foco de hoje</b><span>Checklist, resultado e próxima ação do PE vigente.</span><em>Abrir →</em></a>
        <a class="card portal" href="${routes.questoesErros}"><small>Correção</small><b>Caderno de erros</b><span>Registros reais sincronizados do banco oficial.</span><em>Abrir →</em></a>
        <a class="card portal" href="${routes.evolucao}"><small>Desempenho</small><b>Evolução</b><span>Resultados por período, semana e bloco.</span><em>Abrir →</em></a>
        <a class="card portal" href="${routes.riscos}"><small>Diagnóstico</small><b>Riscos e prioridades</b><span>Reincidências, matérias críticas e foco de revisão.</span><em>Abrir →</em></a>
        <a class="card portal" href="${routes.redacoes}"><small>Discursiva</small><b>Redações</b><span>Status, notas e ritmo do banco oficial de redações.</span><em>Abrir →</em></a>
        <a class="card portal" href="${routes.auditoria}"><small>Governança</small><b>Auditoria</b><span>Fontes, integridade e histórico de sincronização.</span><em>Abrir →</em></a>
      </div>
    </section>

    <section class="section">
      <article class="card panel">
        <h2>Banco de questões de exemplo desativado</h2>
        <p>Esta operação não consulta catálogo, enunciados, alternativas ou gabaritos do projeto editorial de questões. O antigo piloto PE76 permanece fora do fluxo real e não alimenta progresso, revisões ou desempenho.</p>
      </article>
    </section>

    <section class="section">
      <div class="section-head"><div><h2>Fontes oficiais</h2><p>Os três bancos que alimentam este dashboard.</p></div></div>
      <div class="grid three">${sources.map((source, index) => `
        <a class="card source" href="${source.url}" target="_blank" rel="noopener">
          <small>Fonte 0${index + 1}</small>
          <b>${escapeHTML(source.name)}</b>
          <span>Abrir no Notion ↗</span>
        </a>`).join('')}</div>
    </section>

    <footer class="footer"><span>Central de estudo · operação real</span><span>Sincronização: <span data-sync></span></span></footer>`;
} catch (error) {
  setLoadingError(error);
}
