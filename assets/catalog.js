import {loadJSON,setupShell,escapeHTML,routes,setLoadingError} from './common.js?v=22';

const type=document.body.dataset.materialType==='simulado'?'simulado':'prova';
const pageKey=type==='simulado'?'simulados':'provas';
const labels={prova:{title:'Provas anteriores',subtitle:'Resolva provas organizadas por ano, cargo e banca.'},simulado:{title:'Simulados',subtitle:'Treine com simulados autorais, identificados ou sem fonte.'}};

try{
  const [home,data]=await Promise.all([loadJSON('data/home.json'),loadJSON('data/questoes.json')]);
  setupShell(pageKey,home.meta);
  const materials=data.materials.filter(item=>item.type===type);
  const years=[...new Set(materials.map(item=>item.year))].sort((a,b)=>b-a);
  const sources=[...new Set(materials.map(item=>item.source))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  document.querySelector('main').innerHTML=`
    <section class="hero">
      <span class="kicker">Banco interativo</span>
      <h1>${labels[type].title}</h1>
      <p>${labels[type].subtitle}</p>
      <div class="catalog-switch">
        <a class="btn ${type==='prova'?'active':''}" href="${routes.provas}">Provas anteriores</a>
        <a class="btn ${type==='simulado'?'active':''}" href="${routes.simulados}">Simulados</a>
      </div>
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Materiais disponíveis</h2><p>Escolha o modo treino para feedback imediato ou o modo prova para correção ao final.</p></div><span class="stamp">${materials.length} material(is)</span></div>
      <div class="toolbar">
        <label>Ano <select id="year-filter"><option value="">Todos</option>${years.map(y=>`<option value="${y}">${y}</option>`).join('')}</select></label>
        <label>Fonte / Banca <select id="source-filter"><option value="">Todas</option>${sources.map(s=>`<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join('')}</select></label>
        <label>Buscar <input id="material-search" type="search" placeholder="Cargo, título ou fonte"></label>
      </div>
      <div id="material-list" class="material-grid"></div>
    </section>
    <footer class="footer"><span>TDAS · Provas e simulados</span><span>Dados demonstrativos até a primeira importação do Notion</span></footer>`;

  const list=document.querySelector('#material-list');
  const render=()=>{
    const year=document.querySelector('#year-filter').value;
    const source=document.querySelector('#source-filter').value;
    const search=document.querySelector('#material-search').value.trim().toLocaleLowerCase('pt-BR');
    const filtered=materials.filter(m=>(!year||String(m.year)===year)&&(!source||m.source===source)&&(!search||`${m.title} ${m.source} ${m.role}`.toLocaleLowerCase('pt-BR').includes(search)));
    if(!filtered.length){list.innerHTML='<article class="card empty-catalog"><h3>Nenhum material encontrado</h3><p>Ajuste os filtros ou aguarde a próxima importação do banco editorial.</p></article>';return}
    list.innerHTML=filtered.map(m=>`
      <article class="card material-card">
        ${m.demo?'<span class="demo-badge">Conteúdo demonstrativo</span>':''}
        <div class="material-meta"><span class="tag">${escapeHTML(m.year)}</span><span class="tag">${escapeHTML(m.source)}</span><span class="tag">${m.questionIds.length} questões</span></div>
        <h3>${escapeHTML(m.title)}</h3>
        <p>${escapeHTML(m.agency)} · ${escapeHTML(m.role)}${m.roleCode?` · Cargo ${escapeHTML(m.roleCode)}`:''}</p>
        <div class="material-actions">
          <a class="btn primary" href="${routes.resolver}?material=${encodeURIComponent(m.id)}&modo=treino">Modo treino</a>
          <a class="btn" href="${routes.resolver}?material=${encodeURIComponent(m.id)}&modo=prova">Modo prova</a>
        </div>
      </article>`).join('');
  };
  document.querySelectorAll('#year-filter,#source-filter,#material-search').forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',render));
  render();
}catch(error){setLoadingError(error)}
