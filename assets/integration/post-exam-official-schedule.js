import {BASE,loadJSON,fmtDate,escapeHTML} from '../common.js?v=28.0.0';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitFor(selector,attempts=40){
 for(let i=0;i<attempts;i+=1){
  const node=document.querySelector(selector);
  if(node)return node;
  await sleep(100);
 }
 return null;
}

try{
 const schedule=await loadJSON('data/post-exam-official-schedule.json');
 const milestone=schedule?.milestones?.preliminaryKey;
 if(!milestone?.date)throw new Error('Data do gabarito preliminar ausente.');
 const label=fmtDate(milestone.date);
 const next=await waitFor('.postv3-next');
 if(next){
  const foot=next.querySelector('.postv3-next-foot span');
  if(foot)foot.textContent=`Divulgação prevista: ${label}`;
  next.dataset.officialSchedule='1';
  next.dataset.preliminaryDate=milestone.date;
 }
 const current=document.querySelector('.postv3-step.current small');
 if(current)current.textContent=label;
 const sheet=await waitFor('[data-candidate-answer-sheet]',10);
 if(sheet){
  sheet.dataset.preliminaryDate=milestone.date;
  const state=sheet.querySelector('.postv3-sheet-state');
  if(state&&state.textContent.includes('Aguardando'))state.title=`Gabarito preliminar previsto para ${label}`;
 }
 document.documentElement.dataset.officialPreliminaryDate=milestone.date;
 document.documentElement.dataset.officialScheduleSource=escapeHTML(schedule?.source?.organization||'Fonte oficial');
}catch(error){console.warn('Cronograma oficial pós-prova indisponível',error);}
