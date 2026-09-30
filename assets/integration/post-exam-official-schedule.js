import {loadJSON,fmtDate,escapeHTML} from '../common.js?v=28.0.0';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitFor(selector,attempts=40){
 for(let i=0;i<attempts;i+=1){
  const node=document.querySelector(selector);
  if(node)return node;
  await sleep(100);
 }
 return null;
}

function officialAttachmentUrl(value){
 try{
  const url=new URL(String(value||''));
  return url.protocol==='https:'&&url.hostname==='anexos-r2.selecao.net.br'?url.href:'';
 }catch{return ''}
}

try{
 const schedule=await loadJSON('data/post-exam-official-schedule.json');
 const milestones=schedule?.milestones||{};
 const key=milestones.preliminaryKey||{};
 const scheduled=Object.entries(milestones).filter(([,item])=>item?.status==='scheduled'&&item.date).sort(([,a],[,b])=>String(a.date).localeCompare(String(b.date)))[0];
 if(!scheduled)throw new Error('Próximo marco oficial não cadastrado.');
 const[nextKey,nextMilestone]=scheduled;
 const dateLabel=fmtDate(nextMilestone.date);
 const next=await waitFor('.postv3-next');
 if(next){
  const title=next.querySelector('h2');
  if(title)title.textContent=nextMilestone.label||'Próximo marco oficial';
  const description=next.querySelector('p');
  if(description)description.textContent=key.status==='published'
   ?`${key.label||'Gabarito preliminar'} publicado em ${fmtDate(key.date)}. O próximo marco oficial é ${nextMilestone.label||'o evento previsto no cronograma'}.`
   :`O próximo marco oficial é ${nextMilestone.label||'o evento previsto no cronograma'}.`;
  const foot=next.querySelector('.postv3-next-foot span');
  if(foot)foot.textContent=`Divulgação prevista: ${dateLabel}`;
  const keyUrl=key.status==='published'?officialAttachmentUrl(key.url):'';
  if(keyUrl){
   let link=next.querySelector('[data-official-key-link]');
   if(!link){
    link=document.createElement('a');
    link.className='btn';
    link.dataset.officialKeyLink='1';
    link.target='_blank';
    link.rel='noopener noreferrer';
    next.insertBefore(link,next.querySelector('.postv3-next-foot'));
   }
   link.href=keyUrl;
   link.textContent='Abrir gabarito preliminar oficial';
  }
  next.dataset.officialSchedule='1';
  next.dataset.nextMilestone=nextKey;
  next.dataset.preliminaryDate=key.date||'';
 }
 const steps=Array.from(document.querySelectorAll('.postv3-step[data-official-milestone]'));
 let completed=0;
 for(const step of steps){
  const item=milestones[step.dataset.officialMilestone];
  if(!item)continue;
  const done=['completed','published'].includes(item.status);
  step.classList.toggle('done',done);
  step.classList.toggle('current',!done&&step.dataset.officialMilestone===nextKey);
  if(done)completed+=1;
  const small=step.querySelector('small');
  if(small&&item.date)small.textContent=`${item.status==='published'?'Publicado':item.status==='completed'?'Realizada':'Previsto'} em ${fmtDate(item.date)}`;
 }
 const progress=document.querySelector('.postv3-progress');
 if(progress)progress.textContent=`${completed} de ${document.querySelectorAll('.postv3-step').length||6} marcos concluídos`;
 const sheet=await waitFor('[data-candidate-answer-sheet]',10);
 if(sheet&&key.date){
  sheet.dataset.preliminaryDate=key.date;
  if(key.status==='published')sheet.dataset.preliminaryPublished='1';
 }
 document.documentElement.dataset.officialPreliminaryDate=key.date||'';
 document.documentElement.dataset.officialScheduleSource=escapeHTML(schedule?.source?.organization||'Fonte oficial');
}catch(error){console.warn('Cronograma oficial pós-prova indisponível',error);}
