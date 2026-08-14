import {BASE,escapeHTML} from '../common.js?v=26.17.0';

const countLabel=data=>`${Number(data.pageCount||0).toLocaleString('pt-BR')} páginas · ${Number(data.databaseCount||0).toLocaleString('pt-BR')} bancos · ${Number(data.recordCount||0).toLocaleString('pt-BR')} registros`;

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

async function addMirror(){
 const main=document.querySelector('main');
 if(!main)return false;
 addHeroAction(main);
 if(main.querySelector('[data-notion-home]'))return true;
 const r=await fetch(BASE+'data/notion-mirror/index.json',{cache:'no-store'});
 if(!r.ok)return false;
 const data=await r.json();
 if(data.bootstrap||!Array.isArray(data.pages)||data.pages.length<=1)return false;
 const children=data.pages.filter(p=>p.parentId===data.rootId);
 const s=document.createElement('section');
 s.className='tdas-dashboard-section notion-home-entry';
 s.dataset.notionHome='1';
 s.innerHTML=`<div class="section-head"><div><span class="kicker">Fonte oficial espelhada</span><h2>Meu Notion dentro do TDAS</h2><p>${escapeHTML(countLabel(data))}. Navegue pelas páginas e bancos sem sair da plataforma.</p></div><a class="btn primary" href="${BASE}notion/">Abrir meu Notion</a></div><div class="grid two">${children.map(p=>`<a class="card panel" href="${BASE}notion/?id=${encodeURIComponent(p.id)}"><strong>${escapeHTML(p.icon||'📄')} ${escapeHTML(p.title)}</strong><p>${p.children.length} subpágina(s) · ${p.databases.length} banco(s)</p></a>`).join('')}</div>`;
 const hero=main.querySelector('.tdas-home-focus');
 if(hero)hero.after(s);else main.prepend(s);
 return true;
}

const o=new MutationObserver(()=>addMirror().then(ok=>ok&&o.disconnect()).catch(()=>{}));
o.observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
setTimeout(()=>addMirror().catch(()=>{}),250);
