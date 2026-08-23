import {BASE,escapeHTML} from '../common.js?v=26.17.0';
import {readModuleState} from './module-store.js?v=2.1.0';
import {readSessionDraft} from './session-draft.js?v=1.0.0';
import {buildContinuity} from './continuity-engine.js?v=1.0.0';

const waitForHero=()=>new Promise((resolve,reject)=>{let tries=0;const tick=()=>{const hero=document.querySelector('.tdas-home-focus');if(hero)return resolve(hero);if(tries++>160)return reject(new Error('Home v27: foco principal não foi renderizado.'));setTimeout(tick,35)};tick()});
const icon=kind=>({session:'▶',priorities:'↻',errors:'!',plan:'→'})[kind]||'→';
try{
 const hero=await waitForHero();if(document.querySelector('[data-v27-continuity]'))throw new Error('Home v27 já inicializada.');
 const defaultPrimary=hero.querySelector('.tdas-home-actions .btn.primary');
 const fallbackHref=defaultPrimary?.getAttribute('href')||BASE+'hoje/',fallbackLabel=defaultPrimary?.textContent?.trim()||'Abrir atividade de hoje';
 const fallback={href:fallbackHref,label:fallbackHref.includes('/revisar/')?'Ver prioridades':fallbackLabel,detail:hero.querySelector('.tdas-home-focus-copy')?.textContent?.trim()||'Próxima ação do ciclo oficial'};
 let moduleState={reviews:[],errors:[]},draft=null;
 try{moduleState=readModuleState()}catch(error){console.warn('Home v27: estado local indisponível',error)}
 try{draft=readSessionDraft()}catch(error){console.warn('Home v27: rascunho indisponível',error)}
 const continuity=buildContinuity({draft,moduleState,fallback,now:Date.now()});
 if(continuity.primary&&defaultPrimary){defaultPrimary.href=continuity.primary.href;defaultPrimary.textContent=continuity.primary.label;defaultPrimary.dataset.v27Primary=continuity.primary.kind;}
 const section=document.createElement('section');section.className='tdas-dashboard-section tdas-v27-continuity';section.dataset.v27Continuity='1';
 section.innerHTML=`<div class="section-head"><div><span class="kicker">Continuar de onde parei</span><h2>Fila inteligente de execução</h2><p>A plataforma prioriza uma sessão interrompida e a próxima ação do ciclo. Sinais de revisão aparecem apenas como prioridades para o fluxo externo.</p></div><a class="btn" href="${BASE}hoje/">Ver plano do dia</a></div><div class="tdas-v27-queue">${continuity.queue.map((item,index)=>`<a class="card tdas-v27-queue-item ${index===0?'primary':''}" href="${escapeHTML(item.href)}"><span class="tdas-v27-queue-icon">${icon(item.kind)}</span><span><small>${index===0?'Faça agora':item.kind==='priorities'?'Prioridade externa':'Na sequência'}</small><strong>${escapeHTML(item.label)}</strong><p>${escapeHTML(item.detail)}</p></span><b>›</b></a>`).join('')}</div>`;
 hero.after(section);
}catch(error){if(!/já inicializada/.test(error.message))console.warn(error)}
