import {BASE,escapeHTML} from '../common.js?v=26.1';
import {loadDailyExecution,findDailyExecution,normalizePe} from './daily-execution.js?v=1.1.2';
import {readPeProgress,summarizeProgress} from './daily-progress.js?v=1.0.0';
import {readModuleState} from './module-store.js?v=2.0.0';
import {readSessionDraft} from './session-draft.js?v=1.0.0';

const waitForHome=()=>new Promise((resolve,reject)=>{let attempts=0;const tick=()=>{const main=document.querySelector('main'),hero=main?.querySelector('.hero');if(hero&&!/Carregando/.test(main.textContent))return resolve({main,hero});if(attempts++>150)return reject(new Error('Página inicial não ficou pronta.'));setTimeout(tick,40)};tick()});
const completedStatus=value=>/conclu|finaliz|feito|realiz/i.test(String(value||''));
const peNumber=pe=>Number(String(pe||'').replace(/\D/g,''))||0;
const fmtTime=value=>{if(!value)return'nenhuma atividade local';const date=new Date(value);return Number.isNaN(date.getTime())?'atividade local registrada':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(date)};
function stepCard(label,title,done,active,official=false){return`<div class="command-step ${done?'done':''} ${active?'active':''}"><span>${done?'✓':label}</span><div><b>${escapeHTML(title)}</b><small>${done?(official?'Concluído no registro oficial':'Concluído neste dispositivo'):active?'Próxima ação recomendada':'Pendente'}</small></div></div>`}
function actionFor({pe,progress,draft,attempt,nextPe,dueReview,officialCompleted}){
 if(draft&&normalizePe(draft.peId)===pe){const index=draft.session.currentIndex+1,total=draft.session.questionIds.length;return{stage:'questions',label:`Continuar questão ${index} de ${total}`,detail:`Rascunho salvo em ${fmtTime(draft.savedAt)}.`,href:`${BASE}resolver/?pe=${encodeURIComponent(pe)}&resume=1`};}
 if(dueReview)return{stage:'review',label:`Fazer revisão ${dueReview.stage}`,detail:'Há uma revisão local vencida ou disponível.',href:`${BASE}resolver/?review=${encodeURIComponent(dueReview.id)}`};
 if(officialCompleted&&nextPe)return{stage:'next',label:`Preparar ${nextPe.pe}`,detail:`${pe} foi concluído oficialmente. Próxima atividade: ${nextPe.title||nextPe.pe}.`,href:`${BASE}estudar/?pe=${encodeURIComponent(nextPe.pe)}`};
 if(officialCompleted)return{stage:'done',label:'Ciclo concluído',detail:`${pe} foi concluído oficialmente.`,href:`${BASE}desempenho/`};
 if(!progress.material)return{stage:'material',label:`Começar material do ${pe}`,detail:'Primeiro passo: material premium e Lei Seca indicada.',href:`${BASE}estudar/?pe=${encodeURIComponent(pe)}`};
 if(!progress.questions&&!attempt)return{stage:'questions',label:`Resolver questões do ${pe}`,detail:'O material foi marcado como concluído.',href:`${BASE}resolver/?pe=${encodeURIComponent(pe)}`};
 if(!progress.registered)return{stage:'registered',label:`Fechar registro do ${pe}`,detail:'Confira desempenho e registre a execução oficial.',href:`${BASE}pe/${peNumber(pe)}/`};
 if(nextPe)return{stage:'next',label:`Preparar ${nextPe.pe}`,detail:`${nextPe.title||'Próxima atividade do ciclo'}.`,href:`${BASE}estudar/?pe=${encodeURIComponent(nextPe.pe)}`};
 return{stage:'done',label:'Ciclo concluído',detail:'Todas as etapas locais estão concluídas.',href:`${BASE}desempenho/`};
}
try{
 const[{hero},home,contract,audit,platform]=await Promise.all([waitForHome(),fetch(BASE+'data/home.json',{cache:'no-store'}).then(r=>r.json()),loadDailyExecution(),fetch(BASE+'data/audit.json',{cache:'no-store'}).then(r=>r.json()),fetch(BASE+'data/platform-version.json',{cache:'no-store'}).then(r=>r.json())]);
 if(document.querySelector('[data-command-center]'))throw new Error('Central de execução duplicada.');
 document.querySelectorAll('[data-platform-version]').forEach(node=>{node.textContent=`v${platform.platformVersion}`});
 const pe=normalizePe(home.today?.pe),local=readModuleState(),draft=readSessionDraft(),progress=summarizeProgress(readPeProgress(pe)),officialCompleted=completedStatus(home.today?.status);
 const attempt=local.attempts.find(item=>normalizePe(item.peId)===pe&&item.mode==='study')||null;
 const dueReview=local.reviews.filter(item=>item.status==='pending'&&Number(item.dueAt)<=Date.now()).sort((a,b)=>a.dueAt-b.dueAt)[0]||null;
 const nextPeNumber=Math.min(112,peNumber(pe)+1),nextPe=nextPeNumber>peNumber(pe)?findDailyExecution(contract,`PE${String(nextPeNumber).padStart(2,'0')}`):null;
 const effective=officialCompleted?{...progress,material:true,questions:true,registered:true,completed:3,total:3,percent:100,done:true}:{...progress,questions:progress.questions||Boolean(attempt)};
 const action=actionFor({pe,progress:effective,draft,attempt,nextPe,dueReview,officialCompleted});
 const unlinked=Math.max(0,Number(home.metrics?.errors||0)-Number(audit.summary?.linked_error_records||0));
 const sourceCommit=platform.sourceCommit==='unknown'?'local':String(platform.sourceCommit||'').slice(0,7);
 const publication=`Plataforma ${platform.platformVersion} · dados ${platform.dataVersion} · ${platform.peId} · sincronização ${platform.syncDate} · publicação ${sourceCommit}`;
 const section=document.createElement('section');section.className='section command-center';section.dataset.commandCenter=pe;section.dataset.publicationId=platform.publicationId;section.innerHTML=`<div class="section-head"><div><span class="kicker">Central de execução</span><h2>${officialCompleted?`${escapeHTML(pe)} concluído · próximo passo`:`O que fazer agora`}</h2><p>${escapeHTML(action.detail)}</p></div><span class="stamp">${escapeHTML(pe)} · ${effective.completed}/3 etapas</span></div><article class="card command-primary"><div><small>Ação recomendada</small><h2>${escapeHTML(action.label)}</h2><p>O site usa somente dados oficiais publicados e o progresso salvo neste dispositivo.</p></div><a class="btn primary" data-continue-action href="${action.href}">${draft&&action.stage==='questions'?'Continuar de onde parei':'Continuar estudo'} →</a></article><div class="command-steps">${stepCard('1','Material + Lei Seca',effective.material,action.stage==='material',officialCompleted)}${stepCard('2','Questões',effective.questions,action.stage==='questions',officialCompleted)}${stepCard('3','Registro',effective.registered,action.stage==='registered',officialCompleted)}</div><div class="command-meta"><span>Última atividade local: ${escapeHTML(fmtTime(Math.max(Number(draft?.savedAt||0),Number(local.updatedAt||0))))}</span><span data-publication-summary title="${escapeHTML(platform.publicationId)}">${escapeHTML(publication)}</span><a href="${BASE}auditoria/#erros-sem-origem">${unlinked} erros aguardando confirmação de origem</a></div>`;
 hero.after(section);
}catch(error){console.error('Central de execução indisponível',error)}
