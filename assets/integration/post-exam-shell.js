const BASE='/sedes-tdas-dashboard/';

function patchNav(){
 document.querySelectorAll('[data-site-nav="overview"]').forEach(link=>{
  const desktopLabel=link.querySelector('b');
  const desktopHint=link.querySelector('small');
  if(desktopLabel)desktopLabel.textContent='Pós-prova';
  if(desktopHint)desktopHint.textContent='Acompanhar';
  if(!desktopLabel){const spans=link.querySelectorAll(':scope > span');if(spans[1])spans[1].textContent='Pós-prova'}
 });
}

function patchSidebar(){
 const sidebar=document.querySelector('.sidebar');
 if(!sidebar)return false;
 const context=sidebar.querySelector('.sidebar-context');
 if(context){
  const label=context.querySelector('span');
  if(label)label.textContent='Ciclo encerrado';
 }
 const card=sidebar.querySelector('.exam-card');
 if(card)card.innerHTML='<div class="exam-top"><span>Prova realizada</span><b>Concluído</b></div><strong>06 SET 2026</strong><div class="exam-progress"><i style="width:100%"></i></div><small>Pós-prova · aguardando gabarito e resultados</small>';
 patchNav();
 document.documentElement.dataset.tdasPhase='post-exam';
 return true;
}

function patchBreadcrumb(){
 const path=location.pathname.startsWith(BASE)?'/'+location.pathname.slice(BASE.length):location.pathname;
 if(path!=='/'&&path!=='/index.html')return;
 const crumb=document.querySelector('.breadcrumb strong,.crumb strong');
 if(crumb)crumb.textContent='Pós-prova';
}

function patch(){const ready=patchSidebar();patchBreadcrumb();return ready}

patch();
const observer=new MutationObserver(()=>patch());
if(document.body)observer.observe(document.body,{childList:true,subtree:true});
else document.addEventListener('DOMContentLoaded',()=>{patch();observer.observe(document.body,{childList:true,subtree:true})},{once:true});
