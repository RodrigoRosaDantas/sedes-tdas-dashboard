import {BASE,escapeHTML,fmtDate,fmtNumber,fmtPct,loadJSON} from '../common.js?v=26.17.0';
import {readModuleState} from './module-store.js?v=2.1.0';

const completed=value=>/conclu|finaliz|feito|realiz/i.test(String(value||''));
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const clean=value=>String(value||'').trim();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const examCountdown=value=>{const[y,m,d]=String(value||'').split('-').map(Number),now=new Date();return y&&m&&d?Math.max(0,Math.ceil((Date.UTC(y,m-1,d)-Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()))/86400000)):0};
const fmtShortDate=value=>value?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date(`${value}T12:00:00-03:00`)):'—';
const fmtSync=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'não informada':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}).format(date).replace(',',' ·')};
const byHeading=text=>[...document.querySelectorAll('main > section')].find(section=>clean(section.querySelector('h2')?.textContent)===text)||null;
const link=(href,label,cls='btn')=>{const node=document.createElement('a');node.href=href;node.className=cls;node.textContent=label;return node};
const metric=(label,value,detail,tone='')=>`<article class="card tdas-v28-metric ${tone}"><small>${escapeHTML(label)}</small><strong>${escapeHTML(value)}</strong><span>${escapeHTML(detail)}</span></article>`;

async function waitForSources(){
 for(let i=0;i<180;i++){
  const hero=document.querySelector('.tdas-home-focus'),center=document.querySelector('[data-command-center]'),continuity=document.querySelector('[data-v27-continuity]'),performance=byHeading('Desempenho e cobertura');
  if(hero&&center&&continuity&&performance)return{hero,center,continuity,performance};
  await delay(40);
 }
 throw new Error('TDAS v28: fontes da Home não ficaram prontas.');
}

function compactHero({hero,center,home,today}){
 const centerAction=center.querySelector('[data-continue-action]'),actions=hero.querySelector('.tdas-home-actions'),copy=hero.querySelector('.tdas-home-focus-copy'),quick=hero.querySelector('.tdas-home-quick');
 if(centerAction&&actions){
  const primary=link(centerAction.href,clean(centerAction.textContent).replace(/\s*→\s*$/,''),'btn primary');
  primary.dataset.v28Primary=center.dataset.primaryStage||'official';
  const pe=clean(home.today?.pe),rd=clean(home.today?.rd);
  actions.replaceChildren(primary,link(`${BASE}resolver/?pe=${encodeURIComponent(pe)}`,'Questões','btn tdas-v28-hero-link'),link(`${BASE}redacoes/${rd?`?${new URLSearchParams({rd,pe})}`:`?pe=${encodeURIComponent(pe)}`}`,'Redação','btn tdas-v28-hero-link'),link(`${BASE}hoje/`,'Plano','btn tdas-v28-hero-link'));
 }
 const detail=clean(center.querySelector('.section-head p')?.textContent)||clean(center.querySelector('.command-primary p')?.textContent);
 if(copy&&detail)copy.textContent=detail;
 if(quick){
  const current=home.today||{},attempted=number(current.attempted||current.meta),correct=number(current.acertos),errors=number(current.errors),parts=[];
  if(completed(current.status)){
   parts.push(`${correct}/${attempted||correct} acertos`,`${errors} erro${errors===1?'':'s'}`);
   if(current.rd)parts.push(`${current.rd} concluída`);else parts.push('PE concluído');
  }else parts.push(clean(current.status)||'Em andamento',`${attempted} questões`,clean(current.type||current.block)||'Ciclo oficial');
  quick.innerHTML=parts.map(item=>`<span>${escapeHTML(item)}</span>`).join('');
 }
 hero.querySelector('[data-notion-hero-action]')?.remove();
 hero.dataset.v28Hero='1';
}

function sourceOnly(node){if(node)node.classList.add('tdas-v28-source-only')}

function statusSection({home,evolution,edital,dueReviews}){
 const rows=Array.isArray(evolution.actual)?evolution.actual.slice(-7):[],recent=rows.length?rows.reduce((sum,row)=>sum+number(row.accuracy),0)/rows.length:number(home.metrics?.accuracy),days=examCountdown(home.meta?.examDate),critical=number(edital.summary?.risk?.critical),completedPe=number(home.metrics?.completed),totalPe=number(home.metrics?.totalPE);
 const section=document.createElement('section');section.className='tdas-dashboard-section tdas-v28-block tdas-v28-status';section.dataset.v28Block='status';section.innerHTML=`<div class="section-head"><div><span class="kicker">Reta final</span><h2>Sua situação para a prova</h2><p>Tempo, execução, desempenho e risco em uma leitura de poucos segundos.</p></div></div><div class="tdas-v28-status-grid">${metric('Prova',String(days),days===0?'hoje':`dias · ${fmtDate(home.meta?.examDate)}`,'accent')}${metric('Ciclo',`${completedPe}/${totalPe}`,`${Math.max(0,totalPe-completedPe)} PE pendentes`)}${metric('Aproveitamento recente',fmtPct(recent,1),'média das 7 últimas execuções')}${metric('Revisões vencidas',String(dueReviews),dueReviews?'prioridade antes de avançar':'nenhuma vencida agora',dueReviews?'warn':'good')}${metric('Tópicos críticos',String(critical),'raio-X do edital',critical?'warn':'good')}</div>`;return section;
}

function riskSection({home,today,edital,dueReviews}){
 const alerts=Array.isArray(home.alerts)?home.alerts:[],recentErrors=Array.isArray(today.recentErrors)?today.recentErrors:[],reviewFocus=Array.isArray(today.reviewFocus)?today.reviewFocus:[],risk=edital.summary?.risk||{},priority=Array.isArray(edital.priorityTopics)?edital.priorityTopics.filter(item=>item.risk==='critical').slice(0,2):[];
 const primaryAlert=alerts[0],review=reviewFocus[0];
 const section=document.createElement('section');section.className='tdas-dashboard-section tdas-v28-block tdas-v28-risks';section.dataset.v28Block='risks';section.innerHTML=`<div class="section-head"><div><span class="kicker">Prioridade real</span><h2>Onde posso perder pontos</h2><p>Somente sinais acionáveis: erros, revisões e fragilidades do edital.</p></div></div><div class="tdas-v28-risk-grid">
 <article class="card tdas-v28-risk-card" data-tone="error"><div class="tdas-v28-card-head"><span>Erros catalogados</span><strong>${fmtNumber(home.metrics?.errors||0)}</strong></div><h3>${escapeHTML(primaryAlert?.title||'Erros catalogados para retorno')}</h3><p>${escapeHTML(primaryAlert?.detail||'Use o Caderno para transformar erro real em revisão dirigida.')}</p><div class="tdas-v28-mini-list">${recentErrors.slice(0,2).map(item=>`<span><b>${escapeHTML(item.subject||'Questão')}</b>${escapeHTML(item.title||'Erro recente')}</span>`).join('')||'<span>Nenhum erro recente no PE atual.</span>'}</div><a href="${BASE}caderno-erros/">Revisar erros →</a></article>
 <article class="card tdas-v28-risk-card" data-tone="review"><div class="tdas-v28-card-head"><span>Revisões prioritárias</span><strong>${dueReviews}</strong></div><h3>${dueReviews?`${dueReviews} revisão${dueReviews===1?'':'ões'} vencida${dueReviews===1?'':'s'}`:'Fila local em dia'}</h3><p>${escapeHTML(review?.detail||home.today?.action||'Mantenha D+1, D+7, D+20 e reforços em dia.')}</p><div class="tdas-v28-mini-list"><span><b>PE atual</b>${escapeHTML(home.today?.action||'Conferir fechamento e próxima revisão.')}</span></div><a href="${BASE}revisar/">Abrir revisões →</a></article>
 <article class="card tdas-v28-risk-card" data-tone="edital"><div class="tdas-v28-card-head"><span>Pontos frágeis do edital</span><strong>${number(risk.critical)}</strong></div><h3>${number(risk.critical)} críticos · ${number(risk.attention)} em atenção</h3><p>${number(risk.no_evidence)} tópico${number(risk.no_evidence)===1?'':'s'} ainda sem evidência suficiente no raio-X, mesmo com cobertura concluída.</p><div class="tdas-v28-mini-list">${priority.map(item=>`<span><b>${escapeHTML(item.discipline||'Edital')}</b>${escapeHTML(item.topic||'Revisar agora')}</span>`).join('')||'<span>Nenhum tópico crítico listado.</span>'}</div><a href="${BASE}riscos/">Ver pontos frágeis →</a></article>
 </div>`;return section;
}

function performanceSection({source,intelligence,evolution}){
 const section=document.createElement('section');section.className='tdas-dashboard-section tdas-v28-block tdas-v28-performance';section.dataset.v28Block='performance';section.innerHTML='<div class="section-head"><div><span class="kicker">Tendência</span><h2>Desempenho recente</h2><p>Primeiro o que pode custar ponto; depois, a curva que mostra como o estudo está respondendo.</p></div><a class="btn" href="'+BASE+'desempenho/">Abrir análise completa</a></div>';
 const metrics=intelligence?.querySelector('.grid.metrics');if(metrics){const clone=metrics.cloneNode(true);clone.classList.add('tdas-v28-performance-metrics');section.append(clone)}
 const grid=source?.querySelector('.tdas-reference-grid');if(grid){const clone=grid.cloneNode(true);clone.classList.add('tdas-v28-performance-grid');section.append(clone)}else{const last=Array.isArray(evolution.actual)?evolution.actual.slice(-4):[];const fallback=document.createElement('div');fallback.className='grid metrics';fallback.innerHTML=last.map(item=>metric(item.pe,fmtPct(number(item.accuracy),1),item.block||'Execução')).join('');section.append(fallback)}
 return section;
}

function upcomingSection({agenda}){
 const items=Array.isArray(agenda.next)?agenda.next.slice(0,5):[];const section=document.createElement('section');section.className='tdas-dashboard-section tdas-v28-block tdas-v28-upcoming';section.dataset.v28Block='upcoming';section.innerHTML=`<div class="section-head"><div><span class="kicker">Depois</span><h2>Próximos dias</h2><p>Planejamento separado da ação de agora: veja o que vem, sem competir com a prioridade atual.</p></div><a class="btn" href="${BASE}agenda/">Abrir agenda</a></div><div class="tdas-v28-upcoming-grid">${items.map((item,index)=>`<a class="card tdas-v28-upcoming-item ${index===0?'next':''}" href="${BASE}estudar/?pe=${encodeURIComponent(item.pe||'')}"><small>${index===0?'Próximo':'Na sequência'} · ${escapeHTML(fmtShortDate(item.date))}</small><strong>${escapeHTML(item.pe||'PE')}</strong><span>${escapeHTML(item.title||'Atividade programada')}</span><em>${fmtNumber(item.planned_questions||0)} questões${item.rd?` · ${escapeHTML(item.rd)}`:''}</em></a>`).join('')||'<div class="card panel">Nenhuma atividade futura publicada.</div>'}</div>`;return section;
}

function librarySection({home,edital}){
 const section=document.createElement('section');section.className='tdas-dashboard-section tdas-v28-block tdas-v28-library';section.dataset.v28Block='library';section.innerHTML=`<div class="section-head"><div><span class="kicker">Ferramentas</span><h2>Meu acervo</h2><p>As centrais continuam a um toque, mas não disputam atenção com a reta final.</p></div></div><div class="tdas-v28-library-grid">
 <a class="card tdas-v28-library-card" href="${BASE}resolver/?modo=banco"><span>?</span><div><small>Praticar</small><strong>Banco de Questões</strong><p>Monte baterias por matéria, assunto, origem e tipo.</p></div><b>›</b></a>
 <a class="card tdas-v28-library-card" href="${BASE}caderno-erros/"><span>!</span><div><small>${fmtNumber(home.metrics?.errors||0)} catalogados</small><strong>Caderno de Erros</strong><p>Volte apenas aos erros reais e às recorrências.</p></div><b>›</b></a>
 <a class="card tdas-v28-library-card" href="${BASE}redacoes/"><span>✎</span><div><small>${fmtNumber(home.metrics?.redactions||0)} no banco</small><strong>Redações</strong><p>Produção discursiva, histórico e fechamento.</p></div><b>›</b></a>
 <a class="card tdas-v28-library-card" href="${BASE}materias/"><span>▤</span><div><small>${fmtNumber(edital.summary?.coverage?.studied||0)}/${fmtNumber(edital.summary?.total||0)} tópicos estudados</small><strong>Materiais</strong><p>Biblioteca, matérias e cobertura do edital.</p></div><b>›</b></a>
 </div>`;return section;
}

function systemSection({home,platform}){
 const section=document.createElement('section');section.className='tdas-dashboard-section tdas-v28-block tdas-v28-system';section.dataset.v28Block='system';const sync=fmtSync(platform.syncAt||home.meta?.generatedAt);section.innerHTML=`<div class="tdas-v28-system-shell"><div><span class="kicker">Dados e sistema</span><h2>Base confiável, fora do caminho do estudo</h2><p>Notion → validação GitHub → site · última sincronização ${escapeHTML(sync)}.</p></div><div class="tdas-v28-system-status"><span><i></i>Notion</span><span><i></i>GitHub</span><span><i></i>Site</span></div><div class="tdas-v28-system-actions"><a href="${BASE}notion/">Meu Notion</a><a href="${BASE}auditoria/">Auditoria</a><a href="${BASE}configuracoes/">Configurações</a></div></div>`;return section;
}

try{
 if(document.documentElement.dataset.homeV28==='1')throw new Error('TDAS v28 já inicializada.');
 const[{hero,center,continuity,performance},home,today,agenda,evolution,edital,platform]=await Promise.all([waitForSources(),loadJSON('data/home.json'),loadJSON('data/today.json'),loadJSON('data/agenda.json'),loadJSON('data/evolution.json'),loadJSON('data/edital-status.json'),loadJSON('data/platform-version.json')]);
 let local={reviews:[]};try{local=readModuleState()}catch(error){console.warn('TDAS v28: estado local indisponível',error)}
 const dueReviews=(local.reviews||[]).filter(item=>item?.status==='pending'&&number(item.dueAt)<=Date.now()).length;
 compactHero({hero,center,home,today});
 const intelligence=document.querySelector('[data-study-intelligence]'),notion=document.querySelector('[data-notion-home]');
 [center,continuity,intelligence,notion,byHeading('Dados consolidados do Notion'),byHeading('Hoje e próximo passo'),performance,byHeading('Check do Edital e acervo'),byHeading('O que merece atenção'),byHeading('Centrais de trabalho')].forEach(sourceOnly);
 document.querySelector('.footer')?.classList.add('tdas-v28-source-only');
 const blocks=[statusSection({home,evolution,edital,dueReviews}),riskSection({home,today,edital,dueReviews}),performanceSection({source:performance,intelligence,evolution}),upcomingSection({agenda}),librarySection({home,edital}),systemSection({home,platform})];
 hero.after(...blocks);
 document.documentElement.dataset.homeV28='1';
 document.body.classList.add('tdas-home-v28');
}catch(error){if(!/já inicializada/.test(error.message))console.error('TDAS v28: consolidação da Home indisponível',error)}