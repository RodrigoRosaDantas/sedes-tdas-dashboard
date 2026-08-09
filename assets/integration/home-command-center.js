import {BASE,escapeHTML} from '../common.js?v=26.16.0';
import {loadDailyExecution,findDailyExecution,normalizePe} from './daily-execution.js?v=1.1.2';
import {readPeProgress,summarizeProgress} from './daily-progress.js?v=1.0.0';
import {readModuleState} from './module-store.js?v=2.1.0';
import {sortReviewsByPriority} from './review-engine.js?v=1.0.0';
import {readSessionDraft} from './session-draft.js?v=1.0.0';
import {buildOfficialCycleTasks,selectPrimaryAction} from './daily-priorities.js?v=1.1.0';

const waitForHome=()=>new Promise((resolve,reject)=>{let attempts=0;const tick=()=>{const main=document.querySelector('main'),hero=main?.querySelector('.hero');if(hero&&!/Carregando/.test(main.textContent))return resolve({main,hero});if(attempts++>150)return reject(new Error('Página inicial não ficou pronta.'));setTimeout(tick,40)};tick()});
const completedStatus=value=>/conclu|finaliz|feito|realiz/i.test(String(value||''));
const peNumber=pe=>Number(String(pe||'').replace(/\D/g,''))||0;
const fmtTime=value=>{if(!value)return'nenhuma atividade local';const date=new Date(value);return Number.isNaN(date.getTime())?'atividade local registrada':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(date)};
const fmtSync=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'não informada':`${new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Sao_Paulo'}).format(date)} às ${new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Sao_Paulo'}).format(date)}`};
function showLastSync(syncAt,syncTimes=[]){
 const label=fmtSync(syncAt);
 document.querySelectorAll('[data-sync]').forEach(node=>{
  const previous=node.previousSibling;
  if(previous?.nodeType===3)previous.textContent=String(previous.textContent||'').replace(/Sincronização\s*$/u,'Última sincronização ');
  node.textContent=label;
  node.title=`Última sincronização efetiva: ${label}.${syncTimes.length?` Janelas automáticas: ${syncTimes.join(' · ')}.`:''}`;
 });
 return label;
}
function stepCard(label,title,done,active,official=false){return`<div class="command-step ${done?'done':''} ${active?'active':''}"><span>${done?'✓':label}</span><div><b>${escapeHTML(title)}</b><small>${done?(official?'Concluído no registro oficial':'Concluído neste dispositivo'):active?'Próxima ação recomendada':'Pendente'}</small></div></div>`}
function cycleTaskCard(task,active){const state=task.done?'Concluída no registro oficial':task.id==='next'?'Próximo ciclo':active?'Ação prioritária':'Pendente no ciclo oficial';return`<a class="command-cycle-task ${task.done?'done':''} ${active?'active':''}" href="${task.href}"><span>${task.done?'✓':task.id==='redaction'?'RD':task.id==='official-reviews'?'R':'→'}</span><div><b>${escapeHTML(task.label)}</b><small>${escapeHTML(state)}</small><p>${escapeHTML(task.detail)}</p></div></a>`}
try{
 const[{hero},home,today,contract,audit,platform]=await Promise.all([waitForHome(),fetch(BASE+'data/home.json',{cache:'no-store'}).then(r=>r.json()),fetch(BASE+'data/today.json',{cache:'no-store'}).then(r=>r.json()),loadDailyExecution(),fetch(BASE+'data/audit.json',{cache:'no-store'}).then(r=>r.json()),fetch(BASE+'data/platform-version.json',{cache:'no-store'}).then(r=>r.json())]);
 if(document.querySelector('[data-command-center]'))throw new Error('Central de execução duplicada.');
 document.querySelectorAll('[data-platform-version]').forEach(node=>{node.textContent=`v${platform.platformVersion}`});
 const syncLabel=showLastSync(platform.syncAt,home.meta?.syncTimes||[]);
 const pe=normalizePe(home.today?.pe),local=readModuleState(),draft=readSessionDraft(),progress=summarizeProgress(readPeProgress(pe)),officialCompleted=completedStatus(home.today?.status);
 const attempt=local.attempts.find(item=>normalizePe(item.peId)===pe&&item.mode==='study')||null;
 const dueReview=sortReviewsByPriority(local.reviews.filter(item=>item.status==='pending'&&Number(item.dueAt)<=Date.now()),Date.now())[0]||null;
 const nextPeNumber=Math.min(112,peNumber(pe)+1),nextPe=nextPeNumber>peNumber(pe)?findDailyExecution(contract,`PE${String(nextPeNumber).padStart(2,'0')}`):null;
 const effective=officialCompleted?{...progress,material:true,questions:true,registered:true,completed:3,total:3,percent:100,done:true}:{...progress,questions:progress.questions||Boolean(attempt)};
 const officialTasks=buildOfficialCycleTasks({today,nextPe,base:BASE});
 const currentDraft=Boolean(draft&&normalizePe(draft.peId)===pe),currentStarted=Boolean(currentDraft||attempt||progress.material||progress.questions||progress.registered);
 const overdueItems=Array.isArray(home.overdue)?home.overdue:[],overduePe=!officialCompleted&&!currentStarted?overdueItems[0]:null;
 const action=selectPrimaryAction({pe,progress:effective,draft,attempt,nextPe,dueReview,overduePe,officialCompleted,officialTasks,base:BASE});
 const pendingOfficial=officialCompleted?officialTasks.filter(item=>item.id!=='next'&&!item.done):[];
 const unlinked=Math.max(0,Number(home.metrics?.errors||0)-Number(audit.summary?.linked_error_records||0));
 const sourceCommit=platform.sourceCommit==='unknown'?'local':String(platform.sourceCommit||'').slice(0,7);
 const publication=`Plataforma ${platform.platformVersion} · dados ${platform.dataVersion} · ${platform.peId} · última sincronização ${syncLabel} · publicação ${sourceCommit}`;
 const section=document.createElement('section');section.className='section command-center';section.dataset.commandCenter=pe;section.dataset.publicationId=platform.publicationId;section.dataset.primaryStage=action.stage;section.dataset.lastSyncAt=platform.syncAt;section.innerHTML=`<div class="section-head"><div><span class="kicker">Central de execução</span><h2>${officialCompleted?(pendingOfficial.length?`${escapeHTML(pe)} concluído · fechamento pendente`:`${escapeHTML(pe)} concluído · próximo passo`):action.stage==='overdue'?`${escapeHTML(overduePe.pe)} atrasado · retomar agora`:'O que fazer agora'}</h2><p>${escapeHTML(action.detail)}</p></div><span class="stamp">${escapeHTML(pe)} · ${effective.completed}/3 etapas${overdueItems.length?` · ${overdueItems.length} PE atrasado${overdueItems.length>1?'s':''}`:''}${pendingOfficial.length?` · ${pendingOfficial.length} pendência${pendingOfficial.length>1?'s':''}`:''}</span></div><article class="card command-primary"><div><small>Ação recomendada</small><h2>${escapeHTML(action.label)}</h2><p>${action.stage==='overdue'?`As etapas abaixo continuam refletindo ${escapeHTML(pe)}, o PE atual; primeiro retome a pendência anterior.`:'O site cruza o registro oficial publicado com o progresso salvo somente neste dispositivo.'}</p></div><a class="btn primary" data-continue-action href="${action.href}">${escapeHTML(action.button||'Continuar estudo')} →</a></article><div class="command-steps">${stepCard('1','Material + Lei Seca',effective.material,action.stage==='material',officialCompleted)}${stepCard('2','Questões',effective.questions,action.stage==='questions',officialCompleted)}${stepCard('3','Registro',effective.registered,action.stage==='registered',officialCompleted)}</div>${officialCompleted&&officialTasks.length?`<div class="command-cycle"><div class="command-cycle-head"><b>Fechamento e continuidade</b><span>Redação e revisões não são apagadas pelo avanço do PE.</span></div><div class="command-cycle-grid">${officialTasks.map(task=>cycleTaskCard(task,action.stage===task.id)).join('')}</div></div>`:''}<div class="command-meta"><span>Última atividade local: ${escapeHTML(fmtTime(Math.max(Number(draft?.savedAt||0),Number(local.updatedAt||0))))}</span><span data-publication-summary title="${escapeHTML(platform.publicationId)}">${escapeHTML(publication)}</span><a href="${BASE}auditoria/#erros-sem-origem">${unlinked} erros aguardando confirmação de origem</a></div>`;
 hero.after(section);
}catch(error){console.error('Central de execução indisponível',error)}
