const BASE='/sedes-tdas-dashboard/';
const LEGACY_REVIEW_BRIDGE='./review-catalog-bridge.js?v=1.1.0';
const params=new URLSearchParams(location.search);
const reviewId=params.get('review');
const bankMode=params.get('modo')==='banco'&&!reviewId;
const addBankSwitch=()=>{const main=document.querySelector('main');if(!main)return;const actions=main.querySelector('.hero-actions');if(!actions||actions.querySelector('[data-bank-switch]'))return;const link=document.createElement('a');link.className='btn';link.dataset.bankSwitch='1';link.href=BASE+'resolver/?modo=banco';link.textContent='Banco de questões';actions.append(link)};
function renderLegacyReviewHandoff(){
 const main=document.querySelector('main');if(!main)return;
 main.dataset.reviewHandoff='legacy';
 main.innerHTML=`<section class="hero"><span class="kicker">ChatGPT + Notion</span><h1>A revisão pedagógica acontece no ChatGPT.</h1><p>Este link antigo de revisão foi convertido para o fluxo atual. O TDAS preserva a evidência; no ChatGPT você analisa a causa e decide a ação; no Notion fica somente o registro consolidado.</p><div class="hero-actions"><a class="btn primary" href="${BASE}revisar/?origem=legado&review=${encodeURIComponent(reviewId)}">Abrir análise de evidências →</a><a class="btn" href="${BASE}caderno-erros/">Ver evidências</a><a class="btn" href="${BASE}resolver/">Voltar às questões</a></div></section><section class="section"><div class="grid three"><article class="card portal"><small>1 · TDAS</small><b>Executar e registrar</b><span>Respostas, marcações, tempo e histórico permanecem preservados.</span></article><article class="card portal"><small>2 · ChatGPT</small><b>Analisar e decidir</b><span>Classifique a causa real e escolha a intervenção de estudo.</span></article><article class="card portal"><small>3 · Notion</small><b>Consolidar</b><span>Registre apenas o diagnóstico e a ação que precisam permanecer.</span></article></div></section><footer class="footer"><span>TDAS → ChatGPT → Notion</span><span>Sem revisão adaptativa automática</span></footer>`;
}
if(reviewId){
 document.documentElement.dataset.questionMode='review-handoff';
 document.documentElement.dataset.legacyReviewBridge=LEGACY_REVIEW_BRIDGE;
 const target=new URL(BASE+'revisar/',location.origin);
 target.searchParams.set('origem','legado');
 target.searchParams.set('review',reviewId);
 history.replaceState(null,'',target.href);
 renderLegacyReviewHandoff();
 try{const{setupShell}=await import('../common.js');setupShell('mais',{});}catch(error){console.warn('Shell do handoff legado indisponível',error)}
}
else if(bankMode){document.documentElement.dataset.questionMode='bank';await import('./bank-draft-guard.js?v=1.0.0');await import('./question-bank-player.js?v=1.0.0');await import('./master-bank-ui.js?v=1.0.0');await import('./question-telemetry-runtime.js?v=1.0.0');await import('./attempt-diagnostics.js?v=1.0.0')}
else{document.documentElement.dataset.questionMode='daily';await import('./module-player.js?v=2.1.0');await import('./question-telemetry-runtime.js?v=1.0.0');await import('./daily-question-page.js?v=1.0.2');await import('./attempt-diagnostics.js?v=1.0.0');const observer=new MutationObserver(addBankSwitch);observer.observe(document.querySelector('main')||document.body,{childList:true,subtree:true});addBankSwitch()}
