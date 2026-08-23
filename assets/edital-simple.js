const waitFor=(selector,timeout=15000)=>new Promise(resolve=>{const found=document.querySelector(selector);if(found)return resolve(found);const observer=new MutationObserver(()=>{const node=document.querySelector(selector);if(node){observer.disconnect();resolve(node)}});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{observer.disconnect();resolve(null)},timeout)});

function wrapFilters(section){
 const filters=section.querySelector('.edital-filters');
 if(!filters||filters.closest('.edital-filter-details'))return;
 const details=document.createElement('details');details.className='edital-filter-details';
 const summary=document.createElement('summary');summary.textContent='Filtros avançados';
 filters.before(details);details.append(summary,filters);
}

function simplifyCatalog(section){
 if(!section||section.dataset.simpleCatalog)return;section.dataset.simpleCatalog='1';
 const head=section.querySelector(':scope > .section-head');
 if(head){
  const copy=head.querySelector('div');
  if(copy&&!copy.querySelector('[data-verticalized-label]')){const label=document.createElement('span');label.className='kicker';label.dataset.verticalizedLabel='1';label.textContent='Edital verticalizado';copy.prepend(label)}
  const paragraph=head.querySelector('p');if(paragraph)paragraph.textContent='Lista oficial por código, disciplina e tópico, com cobertura, risco, bateria tópica e próxima ação. Use busca e filtros para localizar qualquer item.';
 }
 wrapFilters(section);
 const movable=[...section.children].filter(node=>node!==head);
 const details=document.createElement('details');details.className='edital-catalog-details';
 const count=document.querySelector('#result-count')?.textContent?.match(/\d+/)?.[0]||'82';
 const summary=document.createElement('summary');summary.innerHTML=`<span>Abrir edital verticalizado</span><small>${count} tópicos · busca, filtros e situação por assunto</small>`;
 const body=document.createElement('div');body.className='edital-catalog-body';
 movable.forEach(node=>body.append(node));details.append(summary,body);section.append(details);
 const params=new URLSearchParams(location.search);if(params.toString()||location.hash==='#topicos')details.open=true;
 const heroCatalogAction=document.querySelector('.edital-hero .hero-actions .btn:first-child');
 heroCatalogAction?.addEventListener('click',()=>{if(heroCatalogAction.getAttribute('href')==='#topicos')details.open=true});
}

function ensureVerticalizedGateway(metrics,catalog){
 if(!metrics||!catalog||document.querySelector('[data-edital-verticalized-gateway]'))return;
 const count=document.querySelector('#result-count')?.textContent?.match(/\d+/)?.[0]||'82';
 const gateway=document.createElement('section');gateway.className='edital-verticalized-gateway';gateway.dataset.editalVerticalizedGateway='1';
 gateway.innerHTML=`<article class="card"><div><span class="kicker">Edital verticalizado</span><h2>Consulte os ${count} tópicos do edital</h2><p>Veja matéria por matéria, tópico por tópico, com cobertura, risco, bateria tópica e próxima ação.</p></div><a class="btn primary" data-open-verticalized href="#topicos">Abrir edital verticalizado</a></article>`;
 metrics.after(gateway);
 gateway.querySelector('[data-open-verticalized]')?.addEventListener('click',()=>{const details=catalog.querySelector('.edital-catalog-details');if(details)details.open=true});
}

function simplifyDiagnostic(section){
 if(!section||section.dataset.simpleDiagnostic)return;section.dataset.simpleDiagnostic='1';
 const kicker=section.querySelector('.kicker'),title=section.querySelector('h2'),description=section.querySelector('.section-head p'),headAction=section.querySelector('.section-head>.btn');
 if(kicker)kicker.textContent='Próxima ação';
 if(title)title.textContent='Pratique uma lacuna do snapshot oficial';
 if(description)description.textContent='A plataforma prioriza tópicos ainda sem bateria oficial. Resolver aqui não cria percentual privado por tópico; qualquer evolução oficial depende das fontes sincronizadas.';
 const summary=section.querySelector('.edital-diagnostic-summary'),grid=section.querySelector('.edital-diagnostic-grid'),note=section.querySelector('.edital-diagnostic-note');
 const summaryItems=summary?[...summary.children]:[],cards=grid?[...grid.children]:[],firstCard=cards[0]||null;
 const firstCardSecondaryActions=firstCard?[...firstCard.querySelectorAll('.edital-diagnostic-actions .btn:not(.primary)')]:[];
 const hasMore=summaryItems.length||cards.length>1||Boolean(note)||Boolean(headAction)||firstCardSecondaryActions.length;
 if(!hasMore)return;
 const details=document.createElement('details');details.className='edital-diagnostic-more';
 const toggle=document.createElement('summary');toggle.textContent=`Ver fila completa${cards.length>1?` · mais ${cards.length-1} prioridade${cards.length-1===1?'':'s'}`:''}`;
 const body=document.createElement('div');body.className='edital-diagnostic-more-body';
 if(summaryItems.length){const extraSummary=document.createElement('div');extraSummary.className='edital-diagnostic-summary edital-diagnostic-summary-extra';summaryItems.forEach(node=>extraSummary.append(node));body.append(extraSummary);summary?.remove()}
 if(cards.length>1){const extraGrid=document.createElement('div');extraGrid.className='edital-diagnostic-grid edital-diagnostic-grid-extra';cards.slice(1).forEach(node=>extraGrid.append(node));body.append(extraGrid)}
 const secondaryActions=[...(headAction?[headAction]:[]),...firstCardSecondaryActions];
 if(secondaryActions.length){const actions=document.createElement('div');actions.className='edital-diagnostic-more-actions';secondaryActions.forEach(node=>actions.append(node));body.append(actions)}
 if(note)body.append(note);details.append(toggle,body);grid?.after(details);
}

function collapseSecondary(main,catalog){
 const reading=main.querySelector('.edital-reading')?.closest('.section');
 const disciplines=main.querySelector('.edital-disciplines')?.closest('.section');
 if((!reading&&!disciplines)||main.querySelector('[data-edital-secondary]'))return;
 const details=document.createElement('details');details.className='edital-secondary';details.dataset.editalSecondary='1';
 const summary=document.createElement('summary');summary.innerHTML='<span>Entender os números e ver por disciplina</span><small>explicações, Raio-X e fontes</small>';
 const body=document.createElement('div');body.className='edital-secondary-body';
 const sourceLinks=document.createElement('div');sourceLinks.className='edital-source-links';
 const heroActions=[...main.querySelectorAll('.edital-hero .hero-actions .btn')];heroActions.slice(1).forEach(link=>sourceLinks.append(link));
 if(sourceLinks.children.length)body.append(sourceLinks);
 if(reading)body.append(reading);if(disciplines)body.append(disciplines);details.append(summary,body);
 catalog?.after(details);
}

function ensurePrimaryActions(hero,diagnostic,catalog){
 const actions=hero.querySelector('.hero-actions');
 const primary=actions?.querySelector('.btn.primary')||actions?.querySelector('.btn');
 if(primary){primary.textContent='Abrir edital verticalizado';primary.setAttribute('href','#topicos');primary.dataset.verticalizedAction='1';primary.addEventListener('click',()=>{const details=catalog?.querySelector('.edital-catalog-details');if(details)details.open=true},{once:false})}
 if(diagnostic&&actions&&!actions.querySelector('[data-edital-next-action]')){const next=document.createElement('a');next.className='btn';next.dataset.editalNextAction='1';next.href='#edital-proxima-acao';next.textContent='Ver próxima ação';actions.append(next)}
}

async function init(){
 const hero=await waitFor('.edital-hero');if(!hero)return;
 document.documentElement.dataset.editalUx='simple';document.body.classList.add('edital-simple');
 const kicker=hero.querySelector('.kicker'),title=hero.querySelector('h1'),paragraph=hero.querySelector('p');
 if(kicker)kicker.textContent='Edital · Cargo 202';
 if(title)title.textContent='Seu edital, sem bagunça';
 if(paragraph)paragraph.innerHTML='Veja <strong>o que já foi coberto</strong>, <strong>o que já foi medido</strong> e <strong>o que fazer agora</strong>. O edital verticalizado continua disponível como consulta principal.';
 const metrics=document.querySelector('.edital-metrics');if(metrics)[...metrics.children].forEach((node,index)=>node.classList.toggle('edital-metric-secondary',index>2));
 const catalog=document.querySelector('#topicos');simplifyCatalog(catalog);ensureVerticalizedGateway(metrics,catalog);
 const diagnostic=await waitFor('[data-edital-diagnostic-queue]',8000);simplifyDiagnostic(diagnostic);
 if(diagnostic)diagnostic.id='edital-proxima-acao';
 if(diagnostic&&catalog&&diagnostic.nextElementSibling!==catalog)catalog.before(diagnostic);
 collapseSecondary(document.querySelector('main'),catalog);
 ensurePrimaryActions(hero,diagnostic,catalog);
}

if(typeof window!=='undefined'&&typeof document!=='undefined')init();
