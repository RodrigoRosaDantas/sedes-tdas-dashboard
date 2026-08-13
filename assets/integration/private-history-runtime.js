import {archiveLocalState,loadCurrentQuestionSource} from './persistence-local.js?v=1.0.0';
import {syncPrivateHistory} from './private-history-sync.js?v=1.0.0';
import {privateHistoryEnabled,getPrivateSession} from './private-history-auth.js?v=1.0.0';
import {dbList,STORES} from './history-db-core.js?v=1.0.0';

let lastFingerprint='',busy=false,timer=null;
function badge(){let node=document.querySelector('[data-private-sync-status]');if(node)return node;node=document.createElement('a');node.href='/sedes-tdas-dashboard/sincronizacao/';node.className='btn';node.dataset.privateSyncStatus='1';node.setAttribute('aria-live','polite');node.textContent='Salvo';document.querySelector('.topbar .actions')?.prepend(node);return node}
function setStatus(text,state='local'){const node=badge();node.textContent=text;node.dataset.syncState=state}
function fingerprint(){try{const module=localStorage.getItem('tdas.202.question-module.v2.state')||'',draft=localStorage.getItem('tdas.202.question-module.v2.draft')||'',telemetry=localStorage.getItem('tdas.202.question-module.v2.telemetry')||'';return`${module.length}:${draft.length}:${telemetry.length}:${module.slice(-80)}:${draft.slice(-80)}`}catch{return String(Date.now())}}
async function pendingCount(){try{return(await dbList(STORES.queue)).filter(item=>item.status!=='synced').length}catch{return 0}}
async function persist({force=false}={}){
 if(busy)return;const current=fingerprint();if(!force&&current===lastFingerprint)return;busy=true;setStatus('Salvando','saving');
 try{const catalog=await loadCurrentQuestionSource().catch(()=>null);await archiveLocalState({catalog});lastFingerprint=current;const pending=await pendingCount();setStatus(pending?'Pendente':'Salvo',pending?'pending':'saved');if(navigator.onLine&&privateHistoryEnabled()){const session=await getPrivateSession().catch(()=>null);if(session){setStatus('Salvando','syncing');const result=await syncPrivateHistory();setStatus(result.status==='synced'?'Sincronizado':result.status==='partial'?'Falha ao sincronizar':'Pendente',result.status)}}}
 catch(error){console.error('Persistência privada',error);setStatus('Falha ao sincronizar','failed')}finally{busy=false}
}
export function startPrivateHistoryRuntime(){if(timer)return;badge();persist({force:true});timer=setInterval(()=>persist(),3000);window.addEventListener('online',()=>persist({force:true}));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')persist({force:true})});window.addEventListener('focus',()=>persist({force:true}))}
if(typeof document!=='undefined')startPrivateHistoryRuntime();
