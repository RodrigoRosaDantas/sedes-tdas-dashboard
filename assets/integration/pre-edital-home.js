import {BASE,setupShell,escapeHTML,setLoadingError} from '../common.js?v=28.0.0';

const OFFICIAL_SEDES='https://www.sedes.df.gov.br/';
const OFFICIAL_QUADRIX='https://quadrix.org.br/informacoes/3056/';
const NOTION_CENTRAL='https://app.notion.com/p/3d5cf5a2673181aa8acbebd128dada89';

function ensureStyle(){
  if(document.querySelector('[data-pre26-style]'))return;
  const style=document.createElement('style');
  style.dataset.pre26Style='1';
  style.textContent=`
    .pre26-home{display:grid;gap:16px;width:100%;min-width:0}.pre26-home *{box-sizing:border-box}.pre26-home a{text-decoration:none}
    .pre26-hero{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px;border:1px solid var(--line);border-radius:20px;background:var(--surface);padding:28px;box-shadow:0 14px 40px rgba(20,30,36,.05)}
    .pre26-copy{min-width:0}.pre26-kicker{display:block;color:var(--muted);font-size:9px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
    .pre26-state{display:inline-flex;align-items:center;gap:8px;margin-top:13px;border-radius:999px;background:color-mix(in srgb,var(--accent) 10%,var(--surface2));padding:7px 10px;color:var(--text);font-size:10px}.pre26-state i{width:7px;height:7px;border-radius:50%;background:var(--accent)}
    .pre26-hero h1{max-width:740px;margin:16px 0 10px;color:var(--text);font-size:clamp(32px,4vw,51px);font-weight:760;letter-spacing:-.055em;line-height:1.03}.pre26-copy>p{max-width:760px;margin:0;color:var(--muted);font-size:13px;line-height:1.65}.pre26-actions{display:flex;gap:9px;margin-top:20px;flex-wrap:wrap}.pre26-actions .btn{min-height:40px}
    .pre26-side{display:flex;min-width:0;flex-direction:column;border:1px solid color-mix(in srgb,var(--accent) 24%,var(--line));border-radius:15px;background:color-mix(in srgb,var(--accent) 4%,var(--surface2));padding:20px}.pre26-side>span{color:var(--muted);font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.pre26-side h2{margin:9px 0 7px;color:var(--text);font-size:22px;letter-spacing:-.035em}.pre26-side p{margin:0;color:var(--muted);font-size:10px;line-height:1.55}.pre26-side-foot{display:flex;align-items:center;gap:8px;margin-top:auto;border-top:1px solid var(--line);padding-top:14px;color:var(--muted);font-size:9px}.pre26-side-foot i{width:7px;height:7px;border-radius:50%;background:#d9a84c}
    .pre26-panel{border:1px solid var(--line);border-radius:17px;background:var(--surface);padding:22px}.pre26-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px}.pre26-head span{display:block;color:var(--muted);font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.pre26-head h2{margin:5px 0 0;color:var(--text);font-size:20px;letter-spacing:-.035em}.pre26-status{color:var(--muted);font-size:9px;font-weight:700}
    .pre26-signals{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:17px}.pre26-signal{min-height:145px;border:1px solid var(--line);border-radius:12px;background:var(--surface2);padding:15px}.pre26-signal b{display:block;color:var(--accent);font-size:10px}.pre26-signal strong{display:block;margin-top:10px;color:var(--text);font-size:13px;line-height:1.25}.pre26-signal p{margin:7px 0 0;color:var(--muted);font-size:9px;line-height:1.5}.pre26-signal small{display:inline-flex;margin-top:14px;border-radius:999px;background:color-mix(in srgb,#d9a84c 13%,var(--surface2));padding:5px 8px;color:var(--text);font-size:8px;font-weight:800}
    .pre26-bottom{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:14px}.pre26-jobs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}.pre26-job{border:1px solid var(--line);border-radius:12px;background:var(--surface2);padding:15px}.pre26-job small{display:block;color:var(--muted);font-size:8px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.pre26-job strong{display:block;margin-top:8px;color:var(--text);font-size:16px}.pre26-job span{display:block;margin-top:6px;color:var(--muted);font-size:10px;line-height:1.5}.pre26-job.primary{border-color:color-mix(in srgb,var(--accent) 32%,var(--line))}
    .pre26-links{display:grid;gap:8px;margin-top:16px}.pre26-link{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--line);border-radius:10px;background:var(--surface2);padding:12px 13px;color:var(--text);font-size:10px;font-weight:700}.pre26-link span{color:var(--muted);font-weight:500}.pre26-link b{color:var(--accent);font-size:15px}
    .pre26-note{display:flex;align-items:flex-start;gap:9px;margin-top:17px;border-top:1px solid var(--line);padding-top:14px;color:var(--muted);font-size:9px;line-height:1.55}.pre26-note i{width:7px;height:7px;flex:0 0 7px;margin-top:4px;border-radius:50%;background:#df6a58}
    .pre26-footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:9px}
    @media(max-width:1050px){.pre26-hero{grid-template-columns:1fr}.pre26-side{min-height:150px}.pre26-signals{grid-template-columns:repeat(2,minmax(0,1fr))}.pre26-bottom{grid-template-columns:1fr}}
    @media(max-width:780px){html[data-tdas-phase="pre-edital"] .content{padding:18px 16px 88px}.pre26-home{gap:12px}.pre26-hero{padding:20px;border-radius:16px}.pre26-hero h1{font-size:clamp(29px,9vw,39px)}.pre26-copy>p{font-size:11px}.pre26-actions{flex-direction:column}.pre26-actions .btn{width:100%;justify-content:center}.pre26-panel{padding:17px}.pre26-head{align-items:flex-start;flex-direction:column}.pre26-signals{grid-template-columns:1fr 1fr;gap:7px}.pre26-signal{min-height:152px;padding:12px 10px}.pre26-bottom{display:grid}.pre26-jobs{grid-template-columns:1fr}.pre26-footer{display:grid;gap:7px}}
    @media(max-width:430px){.pre26-signals{grid-template-columns:1fr}.pre26-signal{min-height:0}}
  `;
  document.head.appendChild(style);
}

try{
  ensureStyle();
  setupShell('pre-edital',{snapshotDate:'2026-09-06'});
  document.documentElement.dataset.tdasPhase='pre-edital';
  document.title='Pré-edital | SEDES/DF';
  const main=document.querySelector('main');
  if(!main)throw new Error('Área principal não encontrada.');
  main.innerHTML=`<div class="pre26-home">
    <section class="pre26-hero">
      <div class="pre26-copy"><span class="pre26-kicker">SEDES/DF · PRÓXIMO CICLO</span><span class="pre26-state"><i></i>Radar ativo · aguardando fonte oficial</span><h1>Preparar o próximo concurso sem perder o histórico.</h1><p>O pós-prova acompanha o ciclo de 2026. Esta área fica reservada ao próximo concurso: cargos, fontes e gatilhos entram aqui somente quando houver confirmação oficial.</p><div class="pre26-actions"><a class="btn primary" href="${BASE}">Voltar ao pós-prova</a><a class="btn" href="${BASE}edital/">Ver edital-base arquivado</a></div></div>
      <aside class="pre26-side"><span>ESTADO DO RADAR</span><h2>Nenhuma mudança publicada</h2><p>Não há notícia oficial cadastrada nesta página. O site não transforma rumor em tarefa.</p><div class="pre26-side-foot"><i></i><span>Base de transição · 06/09/2026</span></div></aside>
    </section>

    <section class="pre26-panel"><div class="pre26-head"><div><span>SINAIS QUE MUDAM A ROTA</span><h2>O que será acompanhado</h2></div><div class="pre26-status">Aguardando publicação oficial</div></div><div class="pre26-signals">
      <article class="pre26-signal"><b>01</b><strong>Autorização e comissão</strong><p>Registrar apenas ato publicado em fonte verificável.</p><small>Acompanhar</small></article>
      <article class="pre26-signal"><b>02</b><strong>Banca e edital</strong><p>Revisar conteúdo e cargos a partir do documento oficial.</p><small>Acompanhar</small></article>
      <article class="pre26-signal"><b>03</b><strong>Vagas e requisitos</strong><p>Separar Técnico e Administrador sem misturar metas.</p><small>Acompanhar</small></article>
      <article class="pre26-signal"><b>04</b><strong>Cronograma</strong><p>Adicionar datas somente depois da publicação confirmada.</p><small>Acompanhar</small></article>
    </div><div class="pre26-note"><i></i><span>O radar é um ponto de decisão. Ele não substitui o portal oficial e não replica o conteúdo completo do Notion.</span></div></section>

    <section class="pre26-bottom">
      <article class="pre26-panel"><div class="pre26-head"><div><span>CARGOS NO RADAR</span><h2>Trilhas mantidas separadas</h2></div></div><div class="pre26-jobs"><div class="pre26-job primary"><small>Referência do projeto</small><strong>Técnico Administrativo · Cargo 202</strong><span>Histórico do ciclo SEDES/DF e base de preparação preservada.</span></div><div class="pre26-job"><small>Referência do projeto</small><strong>Administrador · Cargo 400</strong><span>Trilha de nível superior mantida separada para o próximo ciclo.</span></div></div><div class="pre26-note"><i></i><span>Os cargos acima são referências internas de acompanhamento; não representam vagas ou requisitos futuros antes do edital.</span></div></article>
      <aside class="pre26-panel"><div class="pre26-head"><div><span>FONTES RÁPIDAS</span><h2>Conferir antes de mudar</h2></div></div><div class="pre26-links"><a class="pre26-link" href="${OFFICIAL_SEDES}" target="_blank" rel="noopener noreferrer"><span>Portal oficial SEDES/DF</span><b>↗</b></a><a class="pre26-link" href="${OFFICIAL_QUADRIX}" target="_blank" rel="noopener noreferrer"><span>Quadrix · publicação do ciclo</span><b>↗</b></a><a class="pre26-link" href="${NOTION_CENTRAL}" target="_blank" rel="noopener noreferrer"><span>Central operacional no Notion</span><b>↗</b></a></div></aside>
    </section>

    <footer class="pre26-footer"><span>SEDES/DF · Pré-edital independente do pós-prova</span><span>Atualização depende de fonte oficial</span></footer>
  </div>`;
}catch(error){console.error('Radar pré-edital SEDES/DF indisponível',error);setLoadingError(error)}
