const BASE='/sedes-tdas-dashboard/';
const TRANSITION_PLAN='https://app.notion.com/p/239cf5a2673180a1a2a2df40b502a899';

function setText(node,value){if(node&&node.textContent!==value)node.textContent=value}

function patchDecision(){
 const root=document.querySelector('[data-pro-next]');
 if(!root)return false;
 const head=root.querySelector('.pro26-decision-head');
 setText(head?.querySelector('.pro26-kicker'),'Pós-prova');
 setText(head?.querySelector('.pro26-pe'),'TDAS 202');
 setText(head?.querySelector('.pro26-stage'),'Ciclo encerrado');
 const command=root.querySelector('.pro26-command');
 setText(command?.querySelector('span'),'PRÓXIMO MARCO');
 setText(command?.querySelector('h1'),'Corrigir a prova quando sair o gabarito');
 setText(command?.querySelector('p'),'A preparação foi concluída em 06/09/2026. Agora o foco é registrar correção, nota, recursos, classificação e os próximos atos do concurso.');
 const primary=command?.querySelector('[data-continue-action]');
 if(primary){primary.href=`${BASE}desempenho/`;primary.textContent='Consultar histórico do ciclo →'}
 const priority=root.querySelector('.pro26-priority');
 setText(priority?.querySelector('span'),'ACOMPANHAMENTO');
 setText(priority?.querySelector('h2'),'Aguardando publicação oficial');
 setText(priority?.querySelector('p'),'Quando houver gabarito ou resultado oficial, registrar o evento sem alterar o snapshot final de preparação.');
 const actions=priority?.querySelector('.tdas-home-actions');
 if(actions)actions.innerHTML=`<a href="${BASE}desempenho/">Histórico do ciclo</a><a href="${BASE}sincronizacao/">Publicação TDAS</a><a href="${TRANSITION_PLAN}" target="_blank" rel="noopener noreferrer">Plano de transição ↗</a>`;
 const quick=[...root.querySelectorAll('.tdas-home-quick span')];
 setText(quick[0],'Prova realizada');setText(quick[1],'06/09/2026');setText(quick[2],'Snapshot preservado');
 return true;
}

function patchPulse(){
 const pulse=document.querySelector('.pro26-pulse');
 if(!pulse)return false;
 setText(pulse.querySelector('.pro26-pulse-top b'),'Pós-prova');
 const countdown=pulse.querySelector('[data-pro26-countdown]');
 if(countdown)countdown.innerHTML='<strong>✓</strong><span>prova realizada</span><small>06/09/2026 · SEDES/DF</small>';
 return true;
}

function patchReadiness(){
 const tab=document.querySelector('[data-pro26-tab="readiness"]');
 setText(tab,'Pós-prova');
 const panel=document.querySelector('[data-pro26-panel="readiness"]');
 if(!panel)return false;
 const cards=[...panel.querySelectorAll('article')];
 if(cards[0]){setText(cards[0].querySelector('span'),'PROVA');setText(cards[0].querySelector('strong'),'Realizada');setText(cards[0].querySelector('p'),'Próximo marco: gabarito preliminar e correção.');}
 if(cards[1]){setText(cards[1].querySelector('span'),'CICLO');setText(cards[1].querySelector('p'),'Percentual preservado como fotografia final da preparação.');}
 if(cards[2]){setText(cards[2].querySelector('span'),'EDITAL');setText(cards[2].querySelector('p'),'Cobertura encerrada neste ciclo; manter apenas para consulta histórica.');}
 if(cards[3]){setText(cards[3].querySelector('span'),'PRÓXIMO MARCO');setText(cards[3].querySelector('strong'),'Gabarito');setText(cards[3].querySelector('p'),'Registrar correção, eventual recurso e resultado quando publicados.');}
 return true;
}

function patchAgenda(){
 const card=document.querySelector('[data-pro26-task]');
 if(!card)return false;
 setText(card.querySelector('h2'),'Ciclo encerrado');
 const headerLink=card.querySelector('header a');
 if(headerLink){headerLink.href=`${BASE}agenda/`;headerLink.textContent='Consultar histórico →'}
 const calendar=card.querySelector('[data-pro26-calendar]');
 if(calendar)calendar.innerHTML=`<div class="pro26-empty"><strong>PE01–PE112 preservado como histórico.</strong><br>Não há nova obrigação de estudo neste ciclo após a prova de 06/09/2026.</div>`;
 return true;
}

function addStatusBanner(){
 const grid=document.querySelector('.pro26-decision-grid');
 if(!grid||document.querySelector('[data-post-exam-status]'))return false;
 const section=document.createElement('section');
 section.className='card panel';
 section.dataset.postExamStatus='1';
 section.innerHTML=`<div><span class="pro26-kicker">SEDES/DF 2026</span><h2>TDAS — ciclo de preparação concluído</h2><p>O site entrou em modo pós-prova. PEs, desempenho, erros, edital e materiais permanecem disponíveis como memória do ciclo; novos resultados serão registrados sem sobrescrever essa fotografia.</p><div class="hero-actions"><a class="btn primary" href="${BASE}desempenho/">Ver histórico</a><a class="btn" href="${TRANSITION_PLAN}" target="_blank" rel="noopener noreferrer">Plano de transição ↗</a></div></div>`;
 grid.before(section);
 return true;
}

function patch(){
 const ready=patchDecision();
 patchPulse();patchReadiness();patchAgenda();addStatusBanner();
 if(ready)document.documentElement.dataset.tdasPhase='post-exam';
 return ready;
}

if(!patch()){
 const observer=new MutationObserver(()=>{if(patch())observer.disconnect()});
 observer.observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
 setTimeout(()=>observer.disconnect(),15000);
}
