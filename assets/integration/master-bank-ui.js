import {BASE} from '../common.js?v=26.17.0';

async function loadSummary(){
 try{
  const response=await fetch(BASE+'data/integration/master-question-bank.json',{cache:'no-store'});
  if(!response.ok)return null;
  const snapshot=await response.json();
  if(snapshot?.mode!=='tdas-master-question-bank'||!Number.isFinite(Number(snapshot.questionCount)))return null;
  return{questions:Number(snapshot.questionCount),materials:Number(snapshot.materialCount)||0,commit:String(snapshot.source?.commit||'').slice(0,7)};
 }catch{return null}
}
function decorate(summary){
 const totalNode=document.querySelector('[data-bank-total]');
 const card=document.querySelector('.bank-filter-card');
 if(!summary||!totalNode||!card||card.querySelector('[data-master-bank-summary]'))return false;
 const total=Number(String(totalNode.textContent||'').match(/\d+/)?.[0]||0),other=Math.max(0,total-summary.questions);
 const note=document.createElement('p');note.className='bank-note';note.dataset.masterBankSummary='1';
 note.innerHTML=`<strong>Acervo publicado:</strong> ${summary.questions} questões do Banco Mestre em ${summary.materials} materiais${other?` + ${other} questão${other===1?'':'ões'} do ciclo/arquivo local`:''}.`;
 if(summary.commit)note.title=`Snapshot técnico do Banco Mestre · ${summary.commit}`;
 const grid=card.querySelector('.bank-filter-grid');grid?.before(note);
 return true;
}
const summary=await loadSummary();
if(summary){
 const observer=new MutationObserver(()=>{if(decorate(summary))observer.disconnect()});observer.observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
 decorate(summary);
}
