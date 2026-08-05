import{loadData,escapeHTML}from'../common.js?v=20260805.3';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const format=seconds=>{const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=Math.floor(seconds%60);return[h,m,s].map(value=>String(value).padStart(2,'0')).join(':')};
try{
 const d=await loadData();for(let attempts=0;attempts<100&&!document.querySelector('[data-today-session]');attempts++)await sleep(40);
 const root=document.querySelector('[data-today-session]');if(!root)throw new Error('Checklist diário indisponível.');
 const key=`edas.400.today.${d.today.sprint}.v1`,timerKey=key+'.timer';
 let state={steps:{},notes:'',...(JSON.parse(localStorage.getItem(key)||'{}'))};
 let timer={elapsed:0,running:false,startedAt:null,...(JSON.parse(localStorage.getItem(timerKey)||'{}'))};
 if(timer.running&&timer.startedAt)timer.elapsed+=Math.max(0,Math.floor((Date.now()-timer.startedAt)/1000)),timer.startedAt=Date.now();
 const boxes=[...root.querySelectorAll('[data-step-id]')],progress=document.querySelector('[data-session-progress]'),notes=document.querySelector('[data-session-notes]'),saved=document.querySelector('[data-session-saved]'),display=document.querySelector('[data-timer-display]');
 const persist=()=>{localStorage.setItem(key,JSON.stringify(state));localStorage.setItem(timerKey,JSON.stringify(timer));saved.textContent='Salvo neste aparelho';clearTimeout(persist.t);persist.t=setTimeout(()=>saved.textContent='',1600)};
 const refreshProgress=()=>{const done=boxes.filter(box=>box.checked).length;progress.textContent=`${done}/${boxes.length} · ${Math.round(done/Math.max(1,boxes.length)*100)}%`};
 boxes.forEach(box=>{box.checked=Boolean(state.steps[box.dataset.stepId]);box.addEventListener('change',()=>{state.steps[box.dataset.stepId]=box.checked;refreshProgress();persist()})});
 notes.value=state.notes||'';notes.addEventListener('input',()=>{state.notes=notes.value;persist()});refreshProgress();
 const elapsed=()=>timer.elapsed+(timer.running&&timer.startedAt?Math.floor((Date.now()-timer.startedAt)/1000):0);
 const tick=()=>{display.textContent=format(elapsed())};tick();setInterval(tick,1000);
 document.querySelector('[data-timer-start]')?.addEventListener('click',()=>{if(timer.running)return;timer.running=true;timer.startedAt=Date.now();persist()});
 document.querySelector('[data-timer-pause]')?.addEventListener('click',()=>{if(!timer.running)return;timer.elapsed=elapsed();timer.running=false;timer.startedAt=null;persist();tick()});
 document.querySelector('[data-timer-reset]')?.addEventListener('click',()=>{timer={elapsed:0,running:false,startedAt:null};persist();tick()});
 document.querySelector('[data-copy-summary]')?.addEventListener('click',async()=>{const done=boxes.filter(box=>box.checked).map(box=>box.closest('.check')?.querySelector('b')?.textContent).filter(Boolean);const pending=boxes.filter(box=>!box.checked).map(box=>box.closest('.check')?.querySelector('b')?.textContent).filter(Boolean);const text=[`${d.today.sprint} — ${d.today.title}`,`Tempo: ${format(elapsed())}`,`Concluído: ${done.join('; ')||'nenhuma etapa'}`,`Pendente: ${pending.join('; ')||'nenhuma etapa'}`,state.notes?`Notas: ${state.notes}`:''].filter(Boolean).join('\n');try{await navigator.clipboard.writeText(text);saved.textContent='Resumo copiado'}catch{saved.textContent=escapeHTML('Não foi possível copiar automaticamente')}});
}catch(error){console.error('Execução diária indisponível',error)}
