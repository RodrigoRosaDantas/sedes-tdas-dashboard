const BASE='/sedes-tdas-dashboard/';
const params=new URLSearchParams(location.search);
const reviewId=params.get('review');
const bankMode=params.get('modo')==='banco'&&!reviewId;
const addBankSwitch=()=>{const main=document.querySelector('main');if(!main)return;const actions=main.querySelector('.hero-actions');if(!actions||actions.querySelector('[data-bank-switch]'))return;const link=document.createElement('a');link.className='btn';link.dataset.bankSwitch='1';link.href=BASE+'resolver/?modo=banco';link.textContent='Banco de questões';actions.append(link)};
if(reviewId){document.documentElement.dataset.questionMode='review-handoff';const target=new URL(BASE+'revisar/',location.origin);target.searchParams.set('origem','legado');target.searchParams.set('review',reviewId);location.replace(target.href)}
else if(bankMode){document.documentElement.dataset.questionMode='bank';await import('./bank-draft-guard.js?v=1.0.0');await import('./question-bank-player.js?v=1.0.0');await import('./master-bank-ui.js?v=1.0.0');await import('./question-telemetry-runtime.js?v=1.0.0');await import('./attempt-diagnostics.js?v=1.0.0')}
else{document.documentElement.dataset.questionMode='daily';await import('./module-player.js?v=2.1.0');await import('./question-telemetry-runtime.js?v=1.0.0');await import('./daily-question-page.js?v=1.0.2');await import('./attempt-diagnostics.js?v=1.0.0');const observer=new MutationObserver(addBankSwitch);observer.observe(document.querySelector('main')||document.body,{childList:true,subtree:true});addBankSwitch()}
