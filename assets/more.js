import{loadJSON,setupShell,escapeHTML,setLoadingError}from'./common.js';
const BASE='/sedes-tdas-dashboard/';
const groups=[
 ['Próximo ciclo',[
  {title:'Pré-edital SEDES/DF',desc:'Radar de cargos, fontes oficiais e gatilhos do próximo concurso.',href:`${BASE}pre-edital/`}
 ]],
 ['Preparação arquivada',[
  {title:'PE01–PE112',desc:'Plano completo, agenda e registros dos PEs concluídos.',href:`${BASE}agenda/`},
  {title:'Questões',desc:'Resolver questões no Banco de questões preservado para consulta opcional.',href:`${BASE}resolver/?modo=banco`},
  {title:'Revisões',desc:'Prioridades e sinais que fizeram parte do ciclo de estudos.',href:`${BASE}revisar/`},
  {title:'Caderno de erros',desc:'Erros, reincidências e classificações registradas durante a preparação.',href:`${BASE}caderno-erros/`},
  {title:'Redações',desc:'Banco discursivo, textos e correções preservados.',href:`${BASE}redacoes/`},
  {title:'Biblioteca',desc:'Matérias, leis e materiais utilizados no ciclo.',href:`${BASE}materias/`}
 ]],
 ['Diagnóstico histórico',[
  {title:'Desempenho',desc:'Métricas e fotografia final da preparação.',href:`${BASE}desempenho/`},
  {title:'Evolução',desc:'Tendência e resultados registrados ao longo do ciclo.',href:`${BASE}evolucao/`},
  {title:'Check do Edital',desc:'Cobertura e evidências do Cargo 202 preservadas como histórico.',href:`${BASE}edital/`},
  {title:'Riscos',desc:'Pareto, reincidências e pontos críticos do ciclo encerrado.',href:`${BASE}riscos/`},
  {title:'Mentor TDAS',desc:'Diagnóstico final de forças e fragilidades da preparação.',href:`${BASE}mentor/`}
 ]],
 ['Dados e sistema',[
  {title:'Meu Notion',desc:'Espelho das fontes oficiais usadas pelo TDAS.',href:`${BASE}notion/`},
  {title:'Dados locais',desc:'Backup e persistência dos registros deste dispositivo.',href:`${BASE}dados-locais/`},
  {title:'Publicação',desc:'Status de sincronização e versão publicada.',href:`${BASE}sincronizacao/`},
  {title:'Auditoria',desc:'Diagnóstico técnico e qualidade dos dados.',href:`${BASE}auditoria/`},
  {title:'Configurações',desc:'Preferências, versão e integrações.',href:`${BASE}configuracoes/`},
  {title:'Fila de IA',desc:'Recurso técnico legado preservado no arquivo; sem ação atual.',href:`${BASE}fila-ia/`}
 ]]
];
try{
 const d=await loadJSON('data/more.json');setupShell('mais',d.meta);document.title='Arquivo do ciclo | TDAS';document.documentElement.dataset.tdasArchive='1';
 const main=document.querySelector('main');
 main.innerHTML=`<section class="hero"><span class="kicker">CICLO ENCERRADO</span><h1>Arquivo do ciclo</h1><p>Tudo o que fez parte da preparação continua disponível aqui, mas não aparece mais como tarefa atual. A navegação principal fica reservada ao pós-prova e ao histórico.</p><div class="hero-actions"><a class="btn primary" href="${BASE}">Voltar ao pós-prova</a><a class="btn" href="${BASE}desempenho/">Ver histórico</a></div></section>${groups.map(([name,items])=>`<section class="section"><div class="section-head"><div><h2>${escapeHTML(name)}</h2></div></div><div class="grid portal-grid">${items.map(item=>`<a class="card portal" href="${item.href}"><small>Arquivo</small><b>${escapeHTML(item.title)}</b><span>${escapeHTML(item.desc)}</span><em>Abrir →</em></a>`).join('')}</div></section>`).join('')}<footer class="footer"><span>TDAS · Arquivo do ciclo</span><span>Preparação SEDES/DF 2026 preservada</span></footer>`;
}catch(error){setLoadingError(error)}
