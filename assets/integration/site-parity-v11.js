import './post-exam-shell.js?v=1.0.1';

const BASE='/sedes-tdas-dashboard/';
const SOURCE_SITE_VERSION='v11';
let brandObserver=null;

const navItems=[
 {id:'overview',label:'Pós-prova',hint:'Acompanhar',icon:'⌂',href:BASE},
 {id:'pre-edital',label:'Pré-edital',hint:'Próximo ciclo',icon:'↗',href:BASE+'pre-edital/'},
 {id:'history',label:'Histórico',hint:'Desempenho',icon:'▥',href:BASE+'desempenho/'},
 {id:'archive',label:'Arquivo',hint:'Ciclo completo',icon:'▤',href:BASE+'mais/'}
];

const pageLabels={
 '/':'Pós-prova','/index.html':'Pós-prova','/hoje/':'Arquivo · antigo painel diário',
 '/desempenho/':'Histórico do ciclo','/evolucao/':'Histórico · Evolução','/pre-edital/':'Pré-edital · próximo ciclo',
 '/mais/':'Arquivo do ciclo','/agenda/':'Arquivo · PEs','/pe/':'Arquivo · PEs','/estudar/':'Arquivo · Estudo','/materias/':'Arquivo · Biblioteca','/resolver/':'Arquivo · Questões','/revisar/':'Arquivo · Revisões','/caderno-erros/':'Arquivo · Caderno de erros','/questoes-erros/':'Arquivo · Caderno de erros','/redacoes/':'Arquivo · Redações','/edital/':'Arquivo · Edital','/riscos/':'Arquivo · Riscos','/mentor/':'Arquivo · Mentor','/fila-ia/':'Arquivo · Fila de IA',
 '/auditoria/':'Arquivo · Auditoria','/sincronizacao/':'Arquivo · Publicação','/dados-locais/':'Arquivo · Dados locais','/notion/':'Arquivo · Notion','/configuracoes/':'Configurações'
};
const activeMap={
 '/':'overview','/index.html':'overview',
 '/desempenho/':'history','/evolucao/':'history','/pre-edital/':'pre-edital',
 '/mais/':'archive','/hoje/':'archive','/agenda/':'archive','/pe/':'archive','/estudar/':'archive','/materias/':'archive','/resolver/':'archive','/revisar/':'archive','/caderno-erros/':'archive','/questoes-erros/':'archive','/redacoes/':'archive','/edital/':'archive','/riscos/':'archive','/mentor/':'archive','/fila-ia/':'archive','/auditoria/':'archive','/sincronizacao/':'archive','/dados-locais/':'archive','/notion/':'archive'
};

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const relativePath=()=>location.pathname.startsWith(BASE)?'/'+location.pathname.slice(BASE.length):location.pathname;
function resolveSection(){
 const path=relativePath();
 if(path==='/configuracoes/'||path.startsWith('/configuracoes/'))return'settings';
 if(/^\/pe\/\d+\/?$/.test(path)||/^\/materias\/[^/]+\/?$/.test(path)||path.startsWith('/redacoes/'))return'archive';
 for(const[key,value]of Object.entries(activeMap))if(path===key||path.startsWith(key)&&key!=='/')return value;
 return'archive';
}
function pageLabel(){
 const path=relativePath();
 if(/^\/pe\/\d+\/?$/.test(path))return'Arquivo · PE';
 if(/^\/materias\/[^/]+\/?$/.test(path))return'Arquivo · Biblioteca';
 if(path.startsWith('/redacoes/'))return'Arquivo · Redações';
 for(const[key,value]of Object.entries(pageLabels))if(path===key||path.startsWith(key)&&key!=='/')return value;
 return document.querySelector('.topbar strong')?.textContent?.trim()||'TDAS';
}
function ensureStyle(){
 const styles=[['site-parity-v11','assets/site-parity-v11.css?v=1.1.0'],['site-parity-v11-fixes','assets/site-parity-v11-fixes.css?v=1.1.0'],['site-shell-boot','assets/site-shell-boot.css?v=1.1.0']];
 for(const[key,href]of styles){if(document.querySelector(`link[data-${key}]`))continue;const link=document.createElement('link');link.rel='stylesheet';link.href=BASE+href;link.dataset[key.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]='1';document.head.appendChild(link)}
}
function renderNav(active){return navItems.map(item=>`<a href="${item.href}" class="${item.id===active?'active':''}" data-site-nav="${item.id}"><span class="nav-icon">${item.icon}</span><span><b>${esc(item.label)}</b><small>${esc(item.hint)}</small></span></a>`).join('')}
const mobileNavItems=navItems.filter(item=>item.id!=='pre-edital');
function renderMobileNav(active){return mobileNavItems.map(item=>`<a href="${item.href}" class="${item.id===active?'active':''}" data-site-nav="${item.id}"><span>${item.icon}</span><span>${esc(item.label)}</span></a>`).join('')}
function protectBranding(){
 const label=document.querySelector('.brand small');if(!label)return;
 const normalize=()=>{const version=label.textContent.match(/v[\d.]+/i)?.[0]||'v28.0.0';const expected=`Pós-prova · SEDES/DF · ${version}`;if(label.textContent!==expected)label.textContent=expected};
 normalize();if(brandObserver)brandObserver.disconnect();brandObserver=new MutationObserver(normalize);brandObserver.observe(label,{childList:true,subtree:true,characterData:true});
}
function rebuildSidebar(active){
 const sidebar=document.querySelector('.sidebar');if(!sidebar)return;
 sidebar.innerHTML=`<a class="brand" href="${BASE}" aria-label="TDAS pós-prova"><span class="brand-mark">T<span>.</span></span><span><strong>TDAS</strong><small>Pós-prova · SEDES/DF · v28.0.0</small></span></a><div class="sidebar-context"><span>SEDES/DF 2026</span><strong>Técnico Administrativo</strong><small>Cargo 202 · ciclo encerrado</small></div><nav id="desktop-nav" class="nav sidebar-nav" aria-label="Navegação principal"><span class="nav-heading">Acompanhar</span>${renderNav(active)}</nav><div class="exam-card" data-post-exam="1"><div class="exam-top"><span>Prova realizada</span><b>06/09</b></div><strong>Aguardando gabarito</strong><small>Próximo marco oficial</small></div><a class="sidebar-settings sidebar-notion-link" href="${BASE}notion/" aria-label="Abrir espelho do Notion"><span>⌁</span><div><strong>Meu Notion</strong><small>Mapa seguro de navegação</small></div><b>›</b></a>${needle}`;
 protectBranding();
}
function rebuildTopbar(label){
 const topbar=document.querySelector('.topbar');if(!topbar)return;
 topbar.innerHTML=`<span class="site-sr-only tdas-app-identity">TDAS · SEDES/DF · Técnico Administrativo · Cargo 202</span><div class="breadcrumb crumb"><span>SEDES/DF</span><b>/</b><strong>${esc(label)}</strong></div><button class="global-search tdas-shell-search" type="button" data-site-search aria-label="Buscar no TDAS"><span>⌕</span><span>Buscar no TDAS...</span><kbd>⌘K</kbd></button><div class="topbar-tools actions"><a class="icon-btn" href="${BASE}configuracoes/" aria-label="Abrir configurações">⚙</a><button class="icon-btn" type="button" data-theme-toggle aria-label="Alternar tema">◐</button><button class="btn install-btn" type="button" data-install-button data-install>Instalar</button></div>`;
}
function rebuildMobileNav(active){
 const nav=document.querySelector('#mobile-nav');if(!nav)return;nav.className='mobile-nav';nav.innerHTML=renderMobileNav(active);const shell=document.querySelector('.shell'),main=shell?.querySelector('main');if(shell&&main)shell.insertBefore(nav,main);
}
function updateThemeMeta(){const light=document.documentElement.dataset.theme!=='dark',meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=light?'#f3f4ef':'#101a21'}
async function openGlobalSearch(){try{const module=await import(BASE+'assets/tdas-command-palette.js?v=1.0.3');module.openPalette?.()}catch(error){console.error('Busca global TDAS',error);location.href=BASE+'mais/'}}
function bind(){
 if(document.documentElement.dataset.siteParityBound)return;document.documentElement.dataset.siteParityBound='1';
 document.addEventListener('click',event=>{if(event.target.closest('[data-site-search]')){event.preventDefault();openGlobalSearch();return}if(event.target.closest('[data-theme-toggle]'))setTimeout(updateThemeMeta,0)});
 document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openGlobalSearch()}});
}
function init(){
 try{ensureStyle();document.documentElement.dataset.siteParity=SOURCE_SITE_VERSION;if(!document.documentElement.dataset.theme){try{document.documentElement.dataset.theme=localStorage.getItem('tdas-theme')||'light'}catch{document.documentElement.dataset.theme='light'}}const active=resolveSection(),label=pageLabel();rebuildSidebar(active);rebuildTopbar(label);rebuildMobileNav(active);updateThemeMeta();bind();document.documentElement.dataset.siteShell='ready'}catch(error){document.documentElement.dataset.siteShell='fallback';console.error('Shell TDAS indisponível',error)}
}

export function refreshSiteParity(){init()}
init();
