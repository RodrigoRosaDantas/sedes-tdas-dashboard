import {BASE} from '../common.js?v=26.17.0';
import {readSessionDraft} from './session-draft.js?v=1.0.0';

const currentDraft=()=>{try{return readSessionDraft()}catch{return null}};
const isBank=draft=>String(draft?.catalogId||'').startsWith('tdas-bank-');
function addWarning(){
 const builder=document.querySelector('.bank-builder');if(!builder||builder.querySelector('[data-bank-draft-warning]'))return;
 const draft=currentDraft();if(!draft)return;
 const box=document.createElement('article');box.className='card panel bank-draft-warning';box.dataset.bankDraftWarning='1';
 const total=draft.session?.questionIds?.length||0,current=(draft.session?.currentIndex||0)+1;
 box.innerHTML=isBank(draft)
  ? `<strong>Há uma bateria em andamento.</strong><p>Questão ${current} de ${total}. Você pode continuar antes de montar outra bateria.</p><a class="btn primary" href="${BASE}resolver/?modo=banco&resume=1">Continuar bateria</a>`
  : `<strong>Há uma sessão do PE em andamento.</strong><p>Ela continua preservada. Iniciar uma nova bateria substituirá esse único rascunho ativo.</p><a class="btn primary" href="${BASE}resolver/?resume=1">Continuar sessão do PE</a>`;
 builder.prepend(box);
}
const observer=new MutationObserver(addWarning);observer.observe(document.querySelector('main')||document.body,{childList:true,subtree:true});addWarning();
document.querySelector('main')?.addEventListener('click',event=>{
 const start=event.target.closest('[data-bank-start]');if(!start)return;
 const draft=currentDraft();if(!draft)return;
 const message=isBank(draft)?'Já existe uma bateria em andamento. Iniciar outra substituirá o rascunho atual. Deseja continuar?':'Existe uma sessão do PE em andamento. Iniciar esta bateria substituirá o rascunho dessa sessão. Deseja continuar?';
 if(!globalThis.confirm(message)){event.preventDefault();event.stopImmediatePropagation();}
},true);
