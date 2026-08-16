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
 if(head){const paragraph=head.querySelector('p');if(paragraph)paragraph.textContent='Consulte um tópico específico quando precisar. A lista completa fica recolhida para não competir com a próxima ação.'}
 wrapFilters(section);
 const movable=[...section.children].filter(node=>node!==head);
 const details=document.createElement('details');details.className='edital-catalog-details';
 const summary=document.createElement('summary');summary.innerHTML='<span>Consultar todos os tópicos</span><small>busca, visões e filtros</small><span class="skip">Checklist completo do edital</span>';
 const body=document.createElement('div');body.className='edital-catalog-body';
 movable.forEach(node=>body.append(node));details.append(summary,body);section.append(details);
 const params=new URLSearchParams(location.search);if(params.toString()||location.hash==='#topicos')details.open=true;
 document.querySelector('.edital-hero .hero-actions .btn')?.addEventListener('click',()=>{details.open=true});
}

function simplifyDiagnostic(section){
 if(!section||section.dataset.simpleDiagnostic)return;section.dataset.simpleDiagnostic='1';
 const kicker=section.querySelector('.kicker'),title=section.querySelector('h2'),description=section.querySelector('.section-head p');
 if(kicker)kicker.textContent='Próxima ação';
 if(title)title.textContent='Faça uma aferição curta e feche uma lacuna de evidência';
 if(description)description.textContent='A plataforma já priorizou os tópicos sem bateria. O resultado só conta para o tópico quando o vínculo com as questões é seguro.';
 const summary=section.querySelector('.edital-diagnostic-summary'),grid=section.querySelector('.edital-diagnostic-grid'),note=section.querySelector('.edital-diagnostic-note');
 const summaryItems=summary?[...summary.children]:[],cards=grid?[...grid.children]:[];
 const extras=[...summaryItems.slice(1),...cards.slice(1)];
 if(!extras.length&&!note)return;
 const details=document.createElement('details');details.className='edital-diagnostic-more';
 const toggle=document.createElement('summary');toggle.textContent=`Ver fila completa${cards.length>1?` · mais ${cards.length-1} prioridade${cards.length-1===1?'':'s'}`:''}`;
 const body=document.createElement('div');body.className='edital-diagnostic-more-body';
 if(summaryItems.length>1){const extraSummary=document.createElement('div');extraSummary.className='edital-diagnostic-summary edital-diagnostic-summary-extra';summaryItems.slice(1).forEach(node=>extraSummary.append(node));body.append(extraSummary)}
 if(cards.length>1){const extraGrid=document.createElement('div');extraGrid.className='edital-diagnostic-grid edital-diagnostic-grid-extra';cards.slice(1).forEach(node=>extraGrid.append(node));body.append(extraGrid)}
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

async function init(){
 const hero=await waitFor('.edital-hero');if(!hero)return;
 document.documentElement.dataset.editalUx='simple';document.body.classList.add('edital-simple');
 const kicker=hero.querySelector('.kicker'),title=hero.querySelector('h1'),paragraph=hero.querySelector('p');
 if(kicker)kicker.textContent='Edital · Cargo 202';
 if(title)title.textContent='Seu edital, sem bagunça';
 if(paragraph)paragraph.innerHTML='Veja <strong>o que já foi coberto</strong>, <strong>o que já foi medido</strong> e <strong>o que fazer agora</strong>. Os detalhes continuam disponíveis quando você quiser aprofundar.';
 const metrics=document.querySelector('.edital-metrics');if(metrics)[...metrics.children].forEach((node,index)=>node.classList.toggle('edital-metric-secondary',index>2));
 const catalog=document.querySelector('#topicos');simplifyCatalog(catalog);
 const diagnostic=await waitFor('[data-edital-diagnostic-queue]',8000);simplifyDiagnostic(diagnostic);
 if(diagnostic&&catalog&&diagnostic.nextElementSibling!==catalog)catalog.before(diagnostic);
 collapseSecondary(document.querySelector('main'),catalog);
}

if(typeof window!=='undefined'&&typeof document!=='undefined')init();
