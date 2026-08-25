const BASE='/sedes-tdas-dashboard/';
const SOURCE_SITE_VERSION='v11';

const navItems=[
 {id:'overview',label:'Faça agora',hint:'Comando',icon:'⌂',href:BASE},
 {id:'execute',label:'Resolver questões',hint:'Executar',icon:'▶',href:BASE+'resolver/'},
 {id:'reviews',label:'Revisões',hint:'Reter',icon:'↻',href:BASE+'revisar/'},
 {id:'errors',label:'Caderno de erros',hint:'Corrigir',icon:'!',href:BASE+'caderno-erros/'},
 {id:'syllabus',label:'Check do Edital',hint:'Raio-X',icon:'✓',href:BASE+'edital/'},
 {id:'tools',label:'Recursos v28',hint:'Ferramentas',icon:'✦',href:BASE+'mais/'},
 {id:'operations',label:'Operações',hint:'Monitorar',icon:'◉',href:BASE+'auditoria/'},
 {id:'plan',label:'Plano PE01–PE112',hint:'Ciclo',icon:'↗',href:BASE+'agenda/'},
 {id:'library',label:'Biblioteca',hint:'Conteúdo',icon:'▤',href:BASE+'materias/'},
 {id:'databases',label:'Dados pessoais',hint:'Registros',icon:'▦',href:BASE+'dados-locais/'},
 {id:'settings',label:'Configurações',hint:'Integrações',icon:'⚙',href:BASE+'configuracoes/'}
];

const pageLabels={
 '/':'Faça agora','/index.html':'Faça agora','/hoje/':'Faça agora','/estudar/':'Biblioteca','/resolver/':'Resolver questões','/revisar/':'Revisões','/caderno-erros/':'Caderno de erros','/questoes-erros/':'Caderno de erros','/edital/':'Check do Edital','/riscos/':'Check do Edital','/desempenho/':'Recursos v28','/evolucao/':'Recursos v28','/mais/':'Recursos v28','/auditoria/':'Operações','/sincronizacao/':'Operações','/agenda/':'Plano PE01–PE112','/pe/':'Plano PE01–PE112','/materias/':'Biblioteca','/redacoes/':'Biblioteca','/mentor/':'Recursos v28','/dados-locais/':'Dados pessoais','/notion/':'Configurações','/configuracoes/':'Configurações'
};
const activeMap={
 '/':'overview','/index.html':'overview','/hoje/':'overview','/estudar/':'library','/resolver/':'execute','/revisar/':'reviews','/caderno-erros/':'errors','/questoes-erros/':'errors','/edital/':'syllabus','/riscos/':'syllabus','/desempenho/':'tools','/evolucao/':'tools','/mais/':'tools','/mentor/':'tools','/auditoria/':'operations','/sincronizacao/':'operations','/agenda/':'plan','/pe/':'plan','/materias/':'library','/redacoes/':'library','/dados-locais/':'databases','/notion/':'settings','/configuracoes/':'settings'
};

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const relativePath=()=>location.pathname.startsWith(BASE)?'/'+location.pathname.slice(BASE.length):location.pathname;
function resolveSection(){
 const path=relativePath();
 if(/^\/pe\/\d+\/?$/.test(path))return'plan';
 if(/^\/materias\/[^/]+\/?$/.test(path))return'library';
 if(path.startsWith('/redacoes/'))return'library';
 for(const[key,value]of Object.entries(activeMap))if(path===key||path.startsWith(key)&&key!=='/')return value;
 return'tools';
}
function pageLabel(){
 const path=relativePath();
 if(/^\/pe\/\d+\/?$/.test(path))return'Plano PE01–PE112';
 if(/^\/materias\/[^/]+\/?$/.test(path)||path.startsWith('/redacoes/'))return'Biblioteca';
 for(const[key,value]of Object.entries(pageLabels))if(path===key||path.startsWith(key)&&key!=='/')return value;
 return document.querySelector('.topbar strong')?.textContent?.trim()||'TDAS';
}
function ensureStyle(){
 if(document.querySelector('link[data-site-parity-v11]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href=BASE+'assets/site-parity-v11.css?v=1.0.0';link.dataset.siteParityV11='1';document.head.appendChild(link);
}
function brasiliaNow(){return new Date(new Date().toLocaleString('en-US',{timeZone:'America/Sao_Paulo'}));}
function examState(){
 const now=brasiliaNow(),exam=new Date(2026,8,6,13,0,0),start=new Date(2026,7,4,0,0,0);
 const days=Math.max(0,Math.ceil((exam-now)/86400000));
 const total=Math.max(1,exam-start),elapsed=Math.max(0,Math.min(total,now-start));
 return{days,progress:Math.round(elapsed/total*100)};
}
function renderNav(active){return navItems.filter(item=>item.id!=='settings').map(item=>`<a href="${item.href}" class="${item.id===active?'active':''}" data-site-nav="${item.id}"><span class="nav-icon">${item.icon}</span><span>${esc(item.label)}<small>${esc(item.hint)}</small></span></a>`).join('')}
function renderMobileNav(active){return navItems.map(item=>`<a href="${item.href}" class="${item.id===active?'active':''}" data-site-nav="${item.id}"><span>${item.icon}</span><span>${esc(item.label)}</span></a>`).join('')}
function rebuildSidebar(active){
 const sidebar=document.querySelector('.sidebar');if(!sidebar)return;
 const{days,progress}=examState();
 sidebar.innerHTML=`<a class="brand" href="${BASE}" aria-label="TDAS Dashboard PRO"><span class="brand-mark">T<span>.</span></span><span><strong>TDAS</strong><small>Dashboard PRO</small></span></a><div class="sidebar-context"><span>Projeto ativo</span><strong>SEDES / DF</strong><small>Técnico Administrativo · Cargo 202</small></div><nav id="desktop-nav" class="nav sidebar-nav" aria-label="Navegação principal"><span class="nav-heading">Central de comando</span>${renderNav(active)}</nav><div class="exam-card"><div class="exam-top"><span>Prova oficial</span><b>${days} ${days===1?'dia':'dias'}</b></div><strong>06 SET 2026</strong><div class="exam-progress"><i style="width:${progress}%"></i></div><small>Turno vespertino · Objetiva + redação</small></div><a class="source-link" href="${BASE}notion/">Abrir espelho do Notion <span>↗</span></a><a class="sidebar-settings ${active==='settings'?'active':''}" href="${BASE}configuracoes/"><span>⚙</span><div><strong>Configurações</strong><small><i class="connected"></i> Notion e publicação</small></div><b>›</b></a>`;
}
function rebuildTopbar(label){
 const topbar=document.querySelector('.topbar');if(!topbar)return;
 topbar.innerHTML=`<div class="breadcrumb"><span>SEDES/DF</span><b>/</b><strong>${esc(label)}</strong></div><button class="global-search tdas-shell-search" type="button" data-site-search aria-label="Buscar em todo o projeto"><span>⌕</span><span>Buscar páginas, leis, questões...</span><kbd>⌘K</kbd></button><div class="topbar-tools"><a class="publication-chip" href="${BASE}sincronizacao/" title="Abrir status de publicação"><i class="live-dot"></i><span><b data-publication-status>Verificando</b><small data-brasilia-clock>Brasília</small></span></a><button class="icon-btn" data-theme-toggle aria-label="Alternar tema">◐</button><button class="btn install-btn" data-install-button data-install>Instalar</button></div>`;
}
function rebuildMobileNav(active){
 const nav=document.querySelector('#mobile-nav');if(!nav)return;
 nav.className='mobile-nav';nav.innerHTML=renderMobileNav(active);
 const shell=document.querySelector('.shell'),main=shell?.querySelector('main');if(shell&&main) shell.insertBefore(nav,main);
}
function updateClock(){
 const now=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
 document.querySelectorAll('[data-brasilia-clock]').forEach(node=>node.textContent=`Brasília · ${now}`);
}
function updateThemeMeta(){
 const light=document.documentElement.dataset.theme!=='dark',meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=light?'#f3f4ef':'#101a21';
}
async function openGlobalSearch(){
 try{const module=await import(BASE+'assets/tdas-command-palette.js?v=1');module.openPalette?.()}catch(error){console.error('Busca global TDAS',error);location.href=BASE+'mais/'}
}
function bind(){
 if(document.documentElement.dataset.siteParityBound)return;document.documentElement.dataset.siteParityBound='1';
 document.addEventListener('click',event=>{if(event.target.closest('[data-site-search]')){event.preventDefault();openGlobalSearch();return}if(event.target.closest('[data-theme-toggle]'))setTimeout(updateThemeMeta,0)});
 document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openGlobalSearch()}});
}
function init(){
 ensureStyle();document.documentElement.dataset.siteParity=SOURCE_SITE_VERSION;
 if(!document.documentElement.dataset.theme)document.documentElement.dataset.theme=localStorage.getItem('tdas-theme')||'light';
 const active=resolveSection(),label=pageLabel();rebuildSidebar(active);rebuildTopbar(label);rebuildMobileNav(active);updateClock();updateThemeMeta();bind();
 setInterval(updateClock,30000);
}

init();
