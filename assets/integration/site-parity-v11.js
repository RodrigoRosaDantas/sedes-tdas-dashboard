import './post-exam-shell.js?v=1.0.1';

const BASE='/sedes-tdas-dashboard/';
const SOURCE_SITE_VERSION='v11';
let clockTimer=null;
let brandObserver=null;

const navItems=[
 {id:'overview',label:'Pós-prova',hint:'Agora',icon:'⌂',href:BASE},
 {id:'history',label:'Histórico',hint:'Ciclo',icon:'▥',href:BASE+'desempenho/'},
 {id:'syllabus',label:'Check do Edital',hint:'Cobertura',icon:'✓',href:BASE+'edital/'},
 {id:'writing',label:'Redações',hint:'Discursiva',icon:'✎',href:BASE+'redacoes/'},
 {id:'archive',label:'Arquivo do ciclo',hint:'PEs e materiais',icon:'▤',href:BASE+'agenda/'},
 {id:'operations',label:'Operações',hint:'Dados',icon:'◉',href:BASE+'auditoria/'},
 {id:'settings',label:'Configurações',hint:'Integrações',icon:'⚙',href:BASE+'configuracoes/'}
];

const pageLabels={
 '/':'Pós-prova','/index.html':'Pós-prova','/hoje/':'Pós-prova',
 '/desempenho/':'Histórico do ciclo','/evolucao/':'Histórico · Evolução','/caderno-erros/':'Histórico · Caderno de erros','/questoes-erros/':'Histórico · Caderno de erros',
 '/edital/':'Check do Edital','/riscos/':'Check do Edital',
 '/redacoes/':'Redações',
 '/agenda/':'Arquivo do ciclo','/pe/':'Arquivo do ciclo','/estudar/':'Arquivo · Estudo','/materias/':'Arquivo · Biblioteca','/resolver/':'Arquivo · Questões','/revisar/':'Arquivo · Revisões','/mais/':'Arquivo · Recursos','/mentor/':'Arquivo · Mentor','/fila-ia/':'Arquivo · Fila de IA',
 '/auditoria/':'Operações','/sincronizacao/':'Operações · Publicação','/dados-locais/':'Operações · Dados locais','/notion/':'Operações · Notion',
 '/configuracoes/':'Configurações'
};
const activeMap={
 '/':'overview','/index.html':'overview','/hoje/':'overview',
 '/desempenho/':'history','/evolucao/':'history','/caderno-erros/':'history','/questoes-erros/':'history',
 '/edital/':'syllabus','/riscos/':'syllabus',
 '/redacoes/':'writing',
 '/agenda/':'archive','/pe/':'archive','/estudar/':'archive','/materias/':'archive','/resolver/':'archive','/revisar/':'archive','/mais/':'archive','/mentor/':'archive','/fila-ia/':'archive',
 '/auditoria/':'operations','/sincronizacao/':'operations','/dados-locais/':'operations','/notion/':'operations',
 '/configuracoes/':'settings'
};

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const relativePath=()=>location.pathname.startsWith(BASE)?'/'+location.pathname.slice(BASE.length):location.pathname;
function resolveSection(){
 const path=relativePath();
 if(/^\/pe\/\d+\/?$/.test(path))return'archive';
 if(/^\/materias\/[^/]+\/?$/.test(path))return'archive';
 if(path.startsWith('/redacoes/'))return'writing';
 for(const[key,value]of Object.entries(activeMap))if(path===key||path.startsWith(key)&&key!=='/')return value;
 return'archive';
}
function pageLabel(){
 const path=relativePath();
 if(/^\/pe\/\d+\/?$/.test(path))return'Arquivo do ciclo';
 if(/^\/materias\/[^/]+\/?$/.test(path))return'Arquivo · Biblioteca';
 if(path.startsWith('/redacoes/'))return'Redações';
 for(const[key,value]of Object.entries(pageLabels))if(path===key||path.startsWith(key)&&key!=='/')return value;
 return document.querySelector('.topbar strong')?.textContent?.trim()||'TDAS';
}
function ensureStyle(){
 const styles=[['site-parity-v11','assets/site-parity-v11.css?v=1.1.0'],['site-parity-v11-fixes','assets/site-parity-v11-fixes.css?v=1.1.0'],['site-shell-boot','assets/site-shell-boot.css?v=1.1.0']];
 for(const[key,href]of styles){if(document.querySelector(`link[data-${key}]`))continue;const link=document.createElement('link');link.rel='stylesheet';link.href=BASE+href;link.dataset[key.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]='1';document.head.appendChild(link)}
}
function renderNav(active){return navItems.filter(item=>item.id!=='settings').map(item=>`<a href="${item.href}" class="${item.id===active?'active':''}" data-site-nav="${item.id}"><span class="nav-icon">${item.icon}</span><span><b>${esc(item.label)}</b><small>${esc(item.hint)}</small></span></a>`).join('')}
function renderMobileNav(active){
 const ids=new Set(['overview','history','syllabus','writing','archive']);
 return navItems.filter(item=>ids.has(item.id)).map(item=>`<a href="${item.href}" class="${item.id===active?'active':''}" data-site-nav="${item.id}"><span>${item.icon}</span><span>${esc(item.label)}</span></a>`).join('')
}
function protectBranding(){
 const label=document.querySelector('.brand small');if(!label)return;
 const normalize=()=>{
  const version=label.textContent.match(/v[\d.]+/i)?.[0]||'v28.0.0';
  const expected=`Pós-prova · SEDES/DF · ${version}`;
  if(label.textContent!==expected)label.textContent=expected;
 };
 normalize();
 if(brandObserver)brandObserver.disconnect();
 brandObserver=new MutationObserver(normalize);brandObserver.observe(label,{childList:true,subtree:true,characterData:true});
}
function rebuildSidebar(active){
 const sidebar=document.querySelector('.sidebar');if(!sidebar)return;
 sidebar.innerHTML=`<a class="brand" href="${BASE}" aria-label="TDAS pós-prova"><span class="brand-mark">T<span>.</span></span><span><strong>TDAS</strong><small>Pós-prova · SEDES/DF · v28.0.0</small></span></a><div class="sidebar-context"><span>Pós-prova</span><strong>SEDES / DF 2026</strong><small>Técnico Administrativo · Cargo 202</small></div><nav id="desktop-nav" class="nav sidebar-nav" aria-label="Navegação principal"><span class="nav-heading">Acompanhamento</span>${renderNav(active)}</nav><div class="exam-card" data-post-exam="1"><div class="exam-top"><span>Prova realizada</span><b>Concluído</b></div><strong>06 SET 2026</strong><div class="exam-progress"><i style="width:100%"></i></div><small>Próximo marco · gabarito preliminar</small></div><a class="source-link" href="${BASE}notion/">Dados e espelho do Notion <span>↗</span></a><a class="sidebar-settings ${active==='settings'?'active':''}" href="${BASE}configuracoes/"><span>⚙</span><div><strong>Configurações</strong><small><i class="connected"></i> Notion e publicação</small></div><b>›</b></a>`;
 protectBranding();
}
function rebuildTopbar(label){
 const topbar=document.querySelector('.topbar');if(!topbar)return;
 topbar.innerHTML=`<span class="site-sr-only tdas-app-identity">TDAS · SEDES/DF · Técnico Administrativo · Cargo 202</span><span class="site-sr-only tdas-legacy-more-label">Mais</span><div class="breadcrumb crumb"><span>SEDES/DF</span><b>/</b><strong>${esc(label)}</strong></div><button class="global-search tdas-shell-search" type="button" data-site-search aria-label="Buscar no histórico do TDAS"><span>⌕</span><span>Buscar no histórico do TDAS...</span><kbd>⌘K</kbd></button><div class="topbar-tools actions"><a class="publication-chip" href="${BASE}sincronizacao/" title="Abrir status de publicação"><i class="live-dot"></i><span><b data-publication-status>Verificando</b><small data-brasilia-clock>Brasília</small></span></a><button class="icon-btn" type="button" data-theme-toggle aria-label="Alternar tema">◐</button><button class="btn install-btn" type="button" data-install-button data-install>Instalar</button></div>`;
}
function rebuildMobileNav(active){
 const nav=document.querySelector('#mobile-nav');if(!nav)return;
 nav.className='mobile-nav';nav.innerHTML=renderMobileNav(active);
 const shell=document.querySelector('.shell'),main=shell?.querySelector('main');if(shell&&main)shell.insertBefore(nav,main);
}
function updateClock(){
 const now=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
 document.querySelectorAll('[data-brasilia-clock]').forEach(node=>node.textContent=`Brasília · ${now}`);
}
function updateThemeMeta(){
 const light=document.documentElement.dataset.theme!=='dark',meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=light?'#f3f4ef':'#101a21';
}
async function openGlobalSearch(){
 try{const module=await import(BASE+'assets/tdas-command-palette.js?v=1.0.2');module.openPalette?.()}catch(error){console.error('Busca global TDAS',error);location.href=BASE+'mais/'}
}
function bind(){
 if(document.documentElement.dataset.siteParityBound)return;document.documentElement.dataset.siteParityBound='1';
 document.addEventListener('click',event=>{if(event.target.closest('[data-site-search]')){event.preventDefault();openGlobalSearch();return}if(event.target.closest('[data-theme-toggle]'))setTimeout(updateThemeMeta,0)});
 document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openGlobalSearch()}});
}
function init(){
 try{
  ensureStyle();document.documentElement.dataset.siteParity=SOURCE_SITE_VERSION;
  if(!document.documentElement.dataset.theme){try{document.documentElement.dataset.theme=localStorage.getItem('tdas-theme')||'light'}catch{document.documentElement.dataset.theme='light'}}
  const active=resolveSection(),label=pageLabel();rebuildSidebar(active);rebuildTopbar(label);rebuildMobileNav(active);updateClock();updateThemeMeta();bind();
  if(!clockTimer)clockTimer=setInterval(updateClock,30000);
  document.documentElement.dataset.siteShell='ready';
 }catch(error){document.documentElement.dataset.siteShell='fallback';console.error('Shell TDAS indisponível',error)}
}

export function refreshSiteParity(){init()}
init();
