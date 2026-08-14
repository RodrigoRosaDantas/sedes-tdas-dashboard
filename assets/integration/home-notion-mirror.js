import {BASE,escapeHTML} from '../common.js?v=26.17.0';

const countLabel=data=>`${Number(data.pageCount||0).toLocaleString('pt-BR')} páginas no mapa · ${Number(data.protectedPageCount||0).toLocaleString('pt-BR')} áreas protegidas · ${Number(data.databaseCount||0).toLocaleString('pt-BR')} bancos referenciados`;

function addHeroAction(main){
 const actions=main.querySelector('.tdas-home-actions');
 if(!actions||actions.querySelector('[data-notion-hero-action]'))return;
 const link=document.createElement('a');
 link.className='btn';
 link.dataset.notionHeroAction='1';
 link.href=BASE+'notion/';
 link.textContent='Meu Notion';
 actions.append(link);
}

async function loadHomeMirror(){
 const summary=await fetch(BASE+'data/notion-mirror/summary.json',{cache:'no-store'}).catch(()=>null);
 if(summary?.ok)return summary.json();
 const legacy=await fetch(BASE+'data/notion-mirror/index.json',{cache:'no-store'}).catch(()=>null);
 if(!legacy?.ok)return null;
 const data=await legacy.json();
 return{...data,rootChildren:(data.pages||[]).filter(p=>p.parentId===data.rootId).map(p=>({id:p.id,title:p.title,icon:p.icon,protected:Boolean(p.protected),childCount:(p.children||[]).length,databaseCount:(p.databases||[]).length}))};
}

async function addMirror(){
 const main=document.querySelector('main');
 if(!main)return false;
 addHeroAction(main);
 if(main.querySelector('[data-notion-home]'))return true;
 const data=await loadHomeMirror();
 if(!data||Number(data.pageCount||0)<=1)return false;
 const children=Array.isArray(data.rootChildren)?data.rootChildren:[];
 const s=document.createElement('section');
 s.className='tdas-dashboard-section notion-home-entry';
 s.dataset.notionHome='1';
 s.innerHTML=`<div class="section-head"><div><span class="kicker">Mapa seguro da fonte oficial</span><h2>Meu Notion dentro do TDAS</h2><p>${escapeHTML(countLabel(data))}. O site mostra a estrutura útil, mas mantém respostas, gabaritos, redações reservadas, bancos operacionais e acervos privados somente no Notion.</p></div><a class="btn primary" href="${BASE}notion/">Abrir mapa do Notion</a></div>${children.length?`<div class="grid two">${children.map(p=>`<a class="card panel" href="${BASE}notion/?id=${encodeURIComponent(p.id)}"><strong>${escapeHTML(p.protected?'🔒':p.icon||'📄')} ${escapeHTML(p.title)}</strong><p>${p.protected?'Conteúdo reservado · abrir referência':`${Number(p.childCount||0)} subpágina(s) · ${Number(p.databaseCount||0)} banco(s)`}</p></a>`).join('')}</div>`:''}`;
 const hero=main.querySelector('.tdas-home-focus'),continuity=main.querySelector('[data-v27-continuity]');
 if(continuity)continuity.after(s);else if(hero)hero.after(s);else main.prepend(s);
 return true;
}

const o=new MutationObserver(()=>addMirror().then(ok=>ok&&o.disconnect()).catch(()=>{}));
o.observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
setTimeout(()=>addMirror().catch(()=>{}),250);
