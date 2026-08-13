import {loadJSON,setupShell,setLoadingError} from '../common.js?v=26.17.0';
import {getPrivateSession,privateHistoryEnabled} from './private-history-auth.js?v=1.0.0';
import {archiveLocalState,loadCurrentQuestionSource} from './persistence-local.js?v=1.0.0';
import {dbList,STORES} from './history-db-core.js?v=1.0.0';
import {readModuleState} from './module-store.js?v=2.1.0';
import './private-history-runtime.js?v=1.0.0';
try{
 const shell=await loadJSON('data/more.json');setupShell('mais',shell.meta);const root=document.querySelector('[data-private-history-auth]'),catalog=await loadCurrentQuestionSource().catch(()=>null),audit=await archiveLocalState({catalog}).catch(()=>null),state=readModuleState(),queue=await dbList(STORES.queue).catch(()=>[]),remote=await dbList(STORES.remote).catch(()=>[]),session=privateHistoryEnabled()?await getPrivateSession().catch(()=>null):null;
 const status=privateHistoryEnabled()?(session?'Autenticado':'Aguardando autenticação'):'Backend dedicado ainda não ativado';root.innerHTML=`<div class="grid metrics"><article class="card metric"><small>Status</small><strong>${status}</strong></article><article class="card metric"><small>Tentativas locais</small><strong>${state.attempts.length}</strong></article><article class="card metric"><small>Fila pendente</small><strong>${queue.filter(x=>x.status!=='synced').length}</strong></article><article class="card metric"><small>Remotas</small><strong>${remote.length}</strong></article></div><article class="card panel"><h2>${audit?.pe88?.found?'PE88 localizado neste navegador':'Migração local pronta'}</h2><p>${audit?.pe88?.found?`${audit.pe88.questionResults} respostas individuais foram localizadas no estado real e preparadas para arquivamento.`:'Nenhum dado foi apagado. O site continuará verificando novas tentativas e rascunhos.'}</p><p>O Supabase de outra aplicação permanece fora deste fluxo.</p></article>`;
}catch(error){setLoadingError(error)}
