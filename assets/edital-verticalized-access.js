const waitFor=(selector,timeout=15000)=>new Promise(resolve=>{const found=document.querySelector(selector);if(found)return resolve(found);const observer=new MutationObserver(()=>{const node=document.querySelector(selector);if(node){observer.disconnect();resolve(node)}});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{observer.disconnect();resolve(null)},timeout)});

async function init(){
 const hero=await waitFor('.edital-hero');
 const catalog=await waitFor('#topicos');
 if(!hero||!catalog||document.documentElement.dataset.editalVerticalizedAccess==='1')return;
 document.documentElement.dataset.editalVerticalizedAccess='1';
 const details=catalog.querySelector('.edital-catalog-details');
 const summary=details?.querySelector(':scope > summary');
 const count=document.querySelector('#result-count')?.textContent?.match(/\d+/)?.[0]||'82';
 const sectionHead=catalog.querySelector(':scope > .section-head > div');
 if(sectionHead&&!sectionHead.querySelector('[data-verticalized-label]')){
  const label=document.createElement('span');label.className='kicker';label.dataset.verticalizedLabel='1';label.textContent='Edital verticalizado';sectionHead.prepend(label);
  const paragraph=sectionHead.querySelector('p');if(paragraph)paragraph.textContent='Aqui está a lista oficial por código, disciplina e tópico, com cobertura, risco, bateria tópica e próxima ação. Use busca e filtros quando precisar localizar um item específico.';
 }
 if(summary)summary.innerHTML=`<span>Abrir edital verticalizado</span><small>${count} tópicos · busca, filtros e situação por assunto</small>`;
 const actions=hero.querySelector('.hero-actions');
 let primary=actions?.querySelector('.btn.primary')||actions?.querySelector('.btn');
 if(primary){primary.textContent='Abrir edital verticalizado';primary.href='#topicos';primary.dataset.verticalizedAction='1';primary.addEventListener('click',()=>{if(details)details.open=true});}
 if(actions&&!actions.querySelector('[data-edital-next-action]')){
  const next=document.createElement('a');next.className='btn';next.dataset.editalNextAction='1';next.href='#edital-proxima-acao';next.textContent='Ver próxima ação';actions.append(next);
 }
 if(location.hash==='#topicos'&&details)details.open=true;
}

if(typeof window!=='undefined'&&typeof document!=='undefined')init();
