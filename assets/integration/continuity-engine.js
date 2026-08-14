const BASE='/sedes-tdas-dashboard/';
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const pendingReviews=(moduleState={},now=Date.now())=>(moduleState.reviews||[]).filter(item=>item?.status==='pending'&&number(item.dueAt)<=number(now));
export function buildContinuity({draft=null,moduleState={},fallback=null,now=Date.now()}={}){
 const queue=[],due=pendingReviews(moduleState,now);
 if(draft?.session?.questionIds?.length){
  const current=Math.max(0,number(draft.session.currentIndex))+1,total=draft.session.questionIds.length,answered=Object.keys(draft.session.answers||{}).length,bank=String(draft.catalogId||'').startsWith('tdas-bank-');
  queue.push({kind:'session',priority:100,label:`Continuar questão ${current} de ${total}`,detail:`${answered} resposta${answered===1?'':'s'} preservada${answered===1?'':'s'} · ${bank?'Banco de questões':draft.peId||'sessão em andamento'}`,href:bank?`${BASE}resolver/?modo=banco&resume=1`:`${BASE}resolver/?resume=1`});
 }
 if(due.length){
  queue.push({kind:'review',priority:80,label:`Revisar ${due.length} ${due.length===1?'questão pendente':'questões pendentes'}`,detail:'Fila vencida de revisão espaçada · D+1, D+7, D+20 e reforços',href:`${BASE}revisar/`});
 }
 const errors=(moduleState.errors||[]).length;
 if(errors)queue.push({kind:'errors',priority:40,label:'Tratar caderno de erros',detail:`${errors} erro${errors===1?'':'s'} registrado${errors===1?'':'s'} no histórico local`,href:`${BASE}caderno-erros/`});
 if(fallback?.href&&fallback?.label)queue.push({kind:'plan',priority:20,label:String(fallback.label),detail:String(fallback.detail||'Próxima ação do ciclo oficial'),href:String(fallback.href)});
 queue.sort((a,b)=>b.priority-a.priority);
 const primary=queue[0]||null;
 return{primary,queue:queue.slice(0,3),dueReviews:due.length,hasActiveSession:queue.some(item=>item.kind==='session')};
}
