const BASE='/sedes-tdas-dashboard/';
const main=document.querySelector('main');

function patch(){
 if(!main)return;
 for(const meta of main.querySelectorAll('.pilot-meta'))meta.remove();
 for(const tag of main.querySelectorAll('.tag'))if(tag.textContent.trim()==='Salvo neste dispositivo')tag.textContent='Rascunho local enquanto resolve';
 for(const link of main.querySelectorAll(`a[href="${BASE}revisar/"]`))if(/revis/i.test(link.textContent))link.textContent='Ver prioridades';
 const result=main.querySelector('.pilot-result');
 if(!result)return;
 const heading=result.querySelector('h1')?.textContent||'';
 if(!/acertos|%/.test(heading))return;
 const text=result.querySelector('p');
 if(text)text.textContent='Resultado exibido somente para esta bateria. Ao sair, o TDAS não mantém aproveitamento, respostas concluídas, erros ou revisões como histórico pessoal.';
 const actions=result.querySelector('.hero-actions');
 if(actions){
  const bank=new URLSearchParams(location.search).get('modo')==='banco';
  actions.innerHTML=`<a class="btn primary" href="${BASE}resolver/${bank?'?modo=banco':''}">${bank?'Montar nova bateria':'Nova sessão'}</a><a class="btn" href="${BASE}revisar/">Ver prioridades</a><a class="btn" href="${BASE}mentor/">Abrir Mentor</a>`;
 }
}

if(main){new MutationObserver(patch).observe(main,{childList:true,subtree:true});patch()}
document.documentElement.dataset.persistenceMode='local-only';
