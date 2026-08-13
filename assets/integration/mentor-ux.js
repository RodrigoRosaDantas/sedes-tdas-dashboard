const BASE='/sedes-tdas-dashboard/';
const path=()=>location.pathname.replace(/\/+$/,'/')||'/';
const read=route=>fetch(BASE+route,{cache:'no-store'}).then(response=>response.ok?response.json():null).catch(()=>null);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const pct=value=>`${Number(value||0).toFixed(1).replace('.',',')}%`;
function addHeroAction(){
 const current=path();if(![BASE+'caderno-erros/',BASE+'revisar/',BASE+'desempenho/'].some(route=>current.startsWith(route)))return;
 const hero=document.querySelector('main .hero'),actions=hero?.querySelector('.hero-actions');if(!actions||actions.querySelector('[data-mentor-link]'))return;
 const link=document.createElement('a');link.className='btn';link.href=BASE+'mentor/';link.dataset.mentorLink='';link.textContent=current.startsWith(BASE+'caderno-erros/')?'Ver gravidade no Mentor':current.startsWith(BASE+'revisar/')?'Ver prioridades do Mentor':'Abrir Mentor';actions.appendChild(link)
}
async function addHomeMentor(){
 if(path()!==BASE&&path()!==BASE+'index.html')return;const anchor=document.querySelector('.tdas-home-metrics');if(!anchor||document.querySelector('[data-mentor-mini]'))return;
 const[subjects,evolution,edital]=await Promise.all([read('data/subjects.json'),read('data/evolution.json'),read('data/edital-status.json')]);if(!subjects||!evolution)return;
 const weak=[...(subjects.subjects||[])].sort((a,b)=>Number(b.high_critical||0)-Number(a.high_critical||0)||Number(b.recurrent||0)-Number(a.recurrent||0)||Number(b.errors||0)-Number(a.errors||0))[0];
 const strong=[...(evolution.blocks||[])].filter(item=>Number(item.days||0)>=5&&Number(item.accuracy||0)>=94).sort((a,b)=>Number(b.accuracy||0)-Number(a.accuracy||0)||Number(b.days||0)-Number(a.days||0))[0];
 const card=document.createElement('article');card.className='card mentor-mini';card.dataset.mentorMini='';card.innerHTML=`<small class="kicker">Mentor TDAS</small><h3>Onde seu tempo rende mais agora</h3><div class="mentor-mini-grid"><div><small>Maior concentração histórica</small><strong>${esc(weak?.subject||'Sem sinal')}</strong></div><div><small>Sinal de força oficial</small><strong>${strong?`${esc(strong.block)} · ${pct(strong.accuracy)}`:'Amostra insuficiente'}</strong></div><div><small>Críticos no Edital</small><strong>${Number(edital?.summary?.risk?.critical||0)}</strong></div></div><p>“Mais erros” não significa automaticamente pior percentual; o Mentor cruza datas, reincidência, gravidade, Edital e evidência positiva antes de priorizar.</p><div class="hero-actions"><a class="btn primary" href="${BASE}mentor/">Abrir meu diagnóstico</a><a class="btn" href="${BASE}revisar/">Revisar agora</a></div>`;anchor.after(card)
}
function run(){addHeroAction();addHomeMentor()}
run();
new MutationObserver(()=>addHeroAction()).observe(document.body,{childList:true,subtree:true});
