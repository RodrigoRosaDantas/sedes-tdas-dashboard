import {loadJSON,setupShell,setLoadingError} from '../common.js?v=26.17.0';
import {getPrivateSession,privateHistoryEnabled} from './private-history-auth.js?v=1.2.0';
import {archiveLocalState,loadCurrentQuestionSource} from './persistence-local-v2.js?v=2.0.0';
import {dbList,STORES} from './history-db-core.js?v=1.0.0';
import {readModuleState} from './module-store.js?v=2.1.0';
import {mountPrivateLogin} from './private-history-login.js?v=1.1.0';
import {syncPrivateHistory} from './private-history-sync-v3.js?v=3.0.0';
import {hydratePrivateHistory} from './private-history-materialize.js?v=1.1.0';
import './private-history-runtime-v3.js?v=3.1.0';

try {
  const shell=await loadJSON('data/more.json');
  setupShell('mais',shell.meta);
  const root=document.querySelector('[data-private-history-auth]');
  const session=privateHistoryEnabled()?await getPrivateSession().catch(()=>null):null;
  const catalog=await loadCurrentQuestionSource().catch(()=>null);
  await archiveLocalState({catalog,user:session?.user||{}}).catch(()=>null);
  let initialSync=null;
  if(session&&navigator.onLine)initialSync=await syncPrivateHistory().catch(error=>({status:'failed',error:String(error?.message||error)}));
  if(session)await hydratePrivateHistory().catch(()=>null);
  const state=readModuleState();
  const queue=await dbList(STORES.queue).catch(()=>[]);
  const remote=(await dbList(STORES.remote).catch(()=>[])).filter(item=>session?.user?.id&&item.userId===session.user.id);
  const pending=queue.filter(item=>item.status!=='synced'||(session?.user?.id&&item.syncedUserId!==session.user.id)).length;
  const status=session?'Autenticado · Firebase':'Aguardando autenticação';
  const warning=initialSync?.status==='partial'?`<p><strong>Sincronização parcial:</strong> ${Number(initialSync.failed||0)} item(ns) ainda precisam ser reenviados.</p>`:initialSync?.status==='failed'?'<p><strong>Falha na sincronização inicial.</strong> A conta continua conectada; use “Sincronizar agora” para tentar novamente.</p>':'';
  root.innerHTML=`<div class="grid metrics"><article class="card metric"><small>Status</small><strong>${status}</strong></article><article class="card metric"><small>Tentativas disponíveis</small><strong>${state.attempts.length}</strong></article><article class="card metric"><small>Aguardando sincronização</small><strong>${pending}</strong></article><article class="card metric"><small>Sincronizadas</small><strong>${remote.length}</strong></article></div><article class="card panel"><h2>Histórico pessoal TDAS</h2><p>Tentativas concluídas, respostas, telemetria, erros, marcações, revisões e rascunhos permanecem salvos localmente e entram automaticamente na fila de sincronização.</p><p>PEs já concluídos são tratados somente como histórico de resolução. A sincronização não reabre nem altera o PE no Notion. O Notion continua sendo a fonte oficial do conteúdo; o Firebase guarda apenas os dados pessoais de execução.</p>${warning}</article>`;
  await mountPrivateLogin(root);
} catch(error) {
  setLoadingError(error);
}
