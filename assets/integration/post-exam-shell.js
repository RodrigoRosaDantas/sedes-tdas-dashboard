const BASE='/sedes-tdas-dashboard/';

function setText(node,value){if(node&&node.textContent!==value)node.textContent=value}

function patchNav(){
 document.querySelectorAll('[data-site-nav="overview"]').forEach(link=>{
  const desktopLabel=link.querySelector('b');
  const desktopHint=link.querySelector('small');
  setText(desktopLabel,'Pós-prova');
  setText(desktopHint,'Acompanhar');
  if(!desktopLabel){const spans=link.querySelectorAll(':scope > span');setText(spans[1],'Pós-prova')}
 });
}

function patchSidebar(){
 const sidebar=document.querySelector('.sidebar');
 if(!sidebar)return false;
 const context=sidebar.querySelector('.sidebar-context');
 if(context)setText(context.querySelector('span'),'Ciclo encerrado');
 const card=sidebar.querySelector('.exam-card');
 if(card&&card.dataset.postExam!=='1'){
  card.dataset.postExam='1';
  card.innerHTML='<div class="exam-top"><span>Prova realizada</span><b>Concluído</b></div><strong>06 SET 2026</strong><div class="exam-progress"><i style="width:100%"></i></div><small>Pós-prova · aguardando gabarito e resultados</small>';
 }
 patchNav();
 document.documentElement.dataset.tdasPhase='post-exam';
 return true;
}

function patchBreadcrumb(){
 const path=location.pathname.startsWith(BASE)?'/'+location.pathname.slice(BASE.length):location.pathname;
 if(path!=='/'&&path!=='/index.html')return;
 const crumb=document.querySelector('.breadcrumb strong,.crumb strong');
 setText(crumb,'Pós-prova');
}

function patch(){const ready=patchSidebar();patchBreadcrumb();return ready}

patch();
const observer=new MutationObserver(()=>patch());
if(document.body)observer.observe(document.body,{childList:true,subtree:true});
else document.addEventListener('DOMContentLoaded',()=>{patch();observer.observe(document.body,{childList:true,subtree:true})},{once:true});
