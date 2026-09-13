
const STORAGE_KEY='tdas-focus-timer-v1';
const DEFAULT_MINUTES=60;
const PRESETS=[30,60,90];
const MAX_SESSIONS=60;
const STATUSES=new Set(['idle','running','paused','finished']);

const safeNumber=(value,fallback=0)=>{
 const number=Number(value);
 return Number.isFinite(number)?number:fallback;
};
const clamp=(value,min,max)=>Math.min(max,Math.max(min,safeNumber(value,min)));
const makeId=()=>'focus-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);

function dateKey(value){
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return'';
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const part=type=>parts.find(item=>item.type===type)?.value||'';
 return part('year')+'-'+part('month')+'-'+part('day');
}

function defaultTimer(durationMinutes=DEFAULT_MINUTES){
 const duration=PRESETS.includes(durationMinutes)?durationMinutes:DEFAULT_MINUTES;
 return{version:1,id:null,status:'idle',durationMinutes:duration,elapsedMs:0,startedAt:null,finishedAt:null};
}

function normalizeTimer(raw){
 const durationValue=safeNumber(raw?.durationMinutes,DEFAULT_MINUTES);
 const durationMinutes=PRESETS.includes(durationValue)?durationValue:DEFAULT_MINUTES;
 const limit=durationMinutes*60*1000;
 const status=STATUSES.has(raw?.status)?raw.status:'idle';
 const elapsedMs=clamp(raw?.elapsedMs,0,limit);
 const startedAt=status==='running'&&Number.isFinite(Number(raw?.startedAt))?Number(raw.startedAt):null;
 const finishedAt=Number.isFinite(Number(raw?.finishedAt))?Number(raw.finishedAt):null;
 const id=typeof raw?.id==='string'&&raw.id.length<100?raw.id:null;
 return{version:1,id,status,durationMinutes,elapsedMs,startedAt,finishedAt};
}

function normalizeSession(raw){
 if(!raw||typeof raw!=='object')return null;
 const durationValue=safeNumber(raw.durationMinutes,DEFAULT_MINUTES);
 const durationMinutes=PRESETS.includes(durationValue)?durationValue:DEFAULT_MINUTES;
 const elapsedMs=clamp(raw.elapsedMs,0,durationMinutes*60*1000);
 const finishedAt=safeNumber(raw.finishedAt,0);
 if(typeof raw.id!=='string'||!raw.id||elapsedMs<=0||finishedAt<=0)return null;
 return{id:raw.id.slice(0,100),durationMinutes,elapsedMs,finishedAt,dateKey:dateKey(finishedAt)};
}

function loadStore(){
 const fallback={version:1,timer:defaultTimer(),sessions:[]};
 try{
  const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
  const sessions=[];
  for(const item of Array.isArray(raw?.sessions)?raw.sessions:[]){
   const session=normalizeSession(item);
   if(session&&!sessions.some(existing=>existing.id===session.id))sessions.push(session);
  }
  return{version:1,timer:normalizeTimer(raw?.timer),sessions:sessions.slice(0,MAX_SESSIONS)};
 }catch{return fallback}
}

function saveStore(store){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store));}catch{}
}

function elapsedFor(timer,timestamp=Date.now()){
 const running=timer.status==='running'&&Number.isFinite(timer.startedAt)?Math.max(0,timestamp-timer.startedAt):0;
 return clamp(timer.elapsedMs+running,0,timer.durationMinutes*60*1000);
}

function formatDuration(milliseconds){
 const totalSeconds=Math.max(0,Math.ceil(milliseconds/1000));
 const hours=Math.floor(totalSeconds/3600);
 const minutes=Math.floor((totalSeconds%3600)/60).toString().padStart(2,'0');
 const seconds=(totalSeconds%60).toString().padStart(2,'0');
 return hours?hours+':'+minutes+':'+seconds:minutes+':'+seconds;
}

function formatStudyTotal(milliseconds){
 const minutes=Math.round(milliseconds/60000);
 if(minutes<1)return milliseconds>0?'<1 min':'0 min';
 if(minutes<60)return minutes+' min';
 const hours=Math.floor(minutes/60);
 const rest=minutes%60;
 return rest?hours+'h '+rest+'min':hours+'h';
}

function recordSession(store,timer,elapsedMs,finishedAt){
 if(!timer.id||elapsedMs<=0||store.sessions.some(session=>session.id===timer.id))return;
 store.sessions=[{
  id:timer.id,
  durationMinutes:timer.durationMinutes,
  elapsedMs,
  finishedAt,
  dateKey:dateKey(finishedAt)
 },...store.sessions].slice(0,MAX_SESSIONS);
}

function complete(store,timestamp=Date.now()){
 const timer=store.timer;
 const elapsedMs=elapsedFor(timer,timestamp);
 recordSession(store,timer,elapsedMs,timestamp);
 store.timer={...timer,status:'finished',elapsedMs,startedAt:null,finishedAt:timestamp};
 saveStore(store);
}

const statusLabels={
 idle:'Pronto para começar',
 running:'Em andamento',
 paused:'Pausado',
 finished:'Sessão concluída'
};

export function mountFocusTimer(){
 if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>mountFocusTimer(),{once:true});
  return;
 }
 if(document.querySelector('[data-focus-timer]'))return;

 const root=document.createElement('div');
 root.className='tdas-focus-timer';
 root.dataset.focusTimer='';
 root.innerHTML=[
  '<button class="tdas-focus-trigger" type="button" data-focus-trigger aria-expanded="false" aria-controls="tdas-focus-timer-panel" aria-label="Abrir cronômetro de estudo">',
   '<span class="tdas-focus-trigger-icon" aria-hidden="true">◷</span>',
   '<span data-focus-compact>Foco · 1:00:00</span>',
  '</button>',
  '<section class="tdas-focus-panel" id="tdas-focus-timer-panel" data-focus-panel role="dialog" aria-label="Cronômetro de estudo" hidden>',
   '<div class="tdas-focus-head">',
    '<div><span class="tdas-focus-kicker">FOCO</span><h2>Cronômetro de estudo</h2></div>',
    '<button class="tdas-focus-close" type="button" data-focus-close aria-label="Fechar cronômetro">×</button>',
   '</div>',
   '<p class="tdas-focus-status" data-focus-status aria-live="polite">Pronto para começar</p>',
   '<div class="tdas-focus-display"><strong data-focus-display>1:00:00</strong><span data-focus-display-label>restante</span></div>',
   '<div class="tdas-focus-progress" role="progressbar" aria-label="Progresso da sessão" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span data-focus-progress></span></div>',
   '<div class="tdas-focus-meta"><span data-focus-elapsed>Ativo: 0 min</span><span data-focus-target>Meta: 60 min</span></div>',
   '<fieldset class="tdas-focus-durations"><legend>Meta da sessão</legend><div class="tdas-focus-duration-list"><button class="tdas-focus-duration" type="button" data-focus-duration="30">30 min</button><button class="tdas-focus-duration is-active" type="button" data-focus-duration="60">60 min</button><button class="tdas-focus-duration" type="button" data-focus-duration="90">90 min</button></div></fieldset>',
   '<div class="tdas-focus-controls"><button class="tdas-focus-action primary" type="button" data-focus-start>Iniciar</button><button class="tdas-focus-action" type="button" data-focus-pause>Pausar</button><button class="tdas-focus-action" type="button" data-focus-finish>Encerrar e salvar</button></div>',
   '<button class="tdas-focus-reset" type="button" data-focus-reset>Zerar sessão atual</button>',
   '<p class="tdas-focus-today" data-focus-today>Hoje: 0 min · 0 sessões concluídas</p>',
   '<p class="tdas-focus-note" data-focus-description>O tempo fica salvo somente neste dispositivo.</p>',
  '</section>'
 ].join('');
 document.body.appendChild(root);

 const elements={
  trigger:root.querySelector('[data-focus-trigger]'),
  compact:root.querySelector('[data-focus-compact]'),
  panel:root.querySelector('[data-focus-panel]'),
  close:root.querySelector('[data-focus-close]'),
  display:root.querySelector('[data-focus-display]'),
  displayLabel:root.querySelector('[data-focus-display-label]'),
  status:root.querySelector('[data-focus-status]'),
  progress:root.querySelector('[data-focus-progress]'),
  progressTrack:root.querySelector('.tdas-focus-progress'),
  elapsed:root.querySelector('[data-focus-elapsed]'),
  target:root.querySelector('[data-focus-target]'),
  start:root.querySelector('[data-focus-start]'),
  pause:root.querySelector('[data-focus-pause]'),
  finish:root.querySelector('[data-focus-finish]'),
  reset:root.querySelector('[data-focus-reset]'),
  today:root.querySelector('[data-focus-today]'),
  description:root.querySelector('[data-focus-description]'),
  durations:[...root.querySelectorAll('[data-focus-duration]')]
 };
 let store=loadStore();

 const setPanel=open=>{
  elements.panel.hidden=!open;
  elements.trigger.setAttribute('aria-expanded',String(open));
 };
 const todaySummary=()=>{
  const today=dateKey(Date.now());
  const sessions=store.sessions.filter(session=>session.dateKey===today);
  return{count:sessions.length,total:sessions.reduce((sum,session)=>sum+session.elapsedMs,0)};
 };

 function render(){
  const timestamp=Date.now();
  if(store.timer.status==='running'&&elapsedFor(store.timer,timestamp)>=store.timer.durationMinutes*60*1000)complete(store,timestamp);
  const timer=store.timer;
  const limit=timer.durationMinutes*60*1000;
  const elapsedMs=elapsedFor(timer,timestamp);
  const remainingMs=Math.max(0,limit-elapsedMs);
  const progress=Math.min(100,limit?elapsedMs/limit*100:0);
  const running=timer.status==='running';
  const locked=running||timer.status==='paused';
  const summary=todaySummary();

  root.dataset.state=timer.status;
  elements.trigger.dataset.state=timer.status;
  elements.compact.textContent=timer.status==='finished'?'Foco · Feito':'Foco · '+formatDuration(remainingMs);
  elements.display.textContent=timer.status==='finished'?'Concluído':formatDuration(remainingMs);
  elements.displayLabel.textContent=timer.status==='finished'?'salvo':'restante';
  elements.status.textContent=statusLabels[timer.status];
  elements.elapsed.textContent='Ativo: '+formatStudyTotal(elapsedMs);
  elements.target.textContent='Meta: '+timer.durationMinutes+' min';
  elements.progress.style.width=progress+'%';
  elements.progressTrack.setAttribute('aria-valuenow',String(Math.round(progress)));
  elements.start.textContent=timer.status==='paused'?'Retomar':timer.status==='finished'?'Nova sessão':'Iniciar';
  elements.start.disabled=running;
  elements.pause.disabled=!running;
  elements.finish.disabled=!running&&timer.status!=='paused';
  elements.durations.forEach(button=>{
   const active=Number(button.dataset.focusDuration)===timer.durationMinutes;
   button.classList.toggle('is-active',active);
   button.disabled=locked;
  });
  elements.today.textContent='Hoje: '+formatStudyTotal(summary.total)+' · '+summary.count+' '+(summary.count===1?'sessão concluída':'sessões concluídas');
  elements.description.textContent=timer.status==='running'
   ?'O tempo continua correndo enquanto a sessão estiver iniciada.'
   :timer.status==='paused'
    ?'Sessão pausada. Retome quando quiser continuar.'
    :timer.status==='finished'
     ?'Sessão encerrada e salva neste dispositivo.'
     :'Escolha a meta e inicie. O progresso fica salvo neste dispositivo.';
 }

 function start(){
  const timestamp=Date.now();
  let timer=store.timer;
  if(timer.status==='finished')timer=defaultTimer(timer.durationMinutes);
  if(timer.status==='idle')timer={...timer,id:makeId(),status:'running',startedAt:timestamp};
  else if(timer.status==='paused')timer={...timer,status:'running',startedAt:timestamp};
  store.timer=timer;
  saveStore(store);
  render();
 }

 function pause(){
  if(store.timer.status!=='running')return;
  const timestamp=Date.now();
  store.timer={...store.timer,status:'paused',elapsedMs:elapsedFor(store.timer,timestamp),startedAt:null};
  saveStore(store);
  render();
 }

 function finish(){
  if(store.timer.status!=='running'&&store.timer.status!=='paused')return;
  const timestamp=Date.now();
  const elapsedMs=elapsedFor(store.timer,timestamp);
  recordSession(store,store.timer,elapsedMs,timestamp);
  store.timer={...store.timer,status:'finished',elapsedMs,startedAt:null,finishedAt:timestamp};
  saveStore(store);
  render();
 }

 function reset(){
  store.timer=defaultTimer(store.timer.durationMinutes);
  saveStore(store);
  render();
 }

 elements.trigger.addEventListener('click',()=>setPanel(elements.panel.hidden));
 elements.close.addEventListener('click',()=>{setPanel(false);elements.trigger.focus()});
 elements.start.addEventListener('click',start);
 elements.pause.addEventListener('click',pause);
 elements.finish.addEventListener('click',finish);
 elements.reset.addEventListener('click',reset);
 elements.durations.forEach(button=>button.addEventListener('click',()=>{
  if(store.timer.status==='running'||store.timer.status==='paused')return;
  store.timer=defaultTimer(Number(button.dataset.focusDuration));
  saveStore(store);
  render();
 }));
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!elements.panel.hidden){setPanel(false);elements.trigger.focus()}
 });
 window.addEventListener('storage',event=>{
  if(event.key!==STORAGE_KEY)return;
  store=loadStore();
  render();
 });
 window.addEventListener('pageshow',render);
 document.addEventListener('visibilitychange',render);
 window.setInterval(render,1000);
 render();
}
