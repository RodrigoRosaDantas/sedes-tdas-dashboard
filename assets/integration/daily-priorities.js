const text=value=>String(value??'').trim();
const normalized=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const pending=item=>item&&item.done!==true;
const checklistItems=today=>Array.isArray(today?.checklist)?today.checklist:[];

export function buildOfficialCycleTasks({today,nextPe,base='/'}={}){
 const current=today?.current||{};
 const checklist=checklistItems(today);
 const redactionItem=checklist.find(item=>/^produzir\s+rd\d+/i.test(text(item?.title)));
 const reviewItem=checklist.find(item=>normalized(item?.title).includes('revis'));
 const rd=text(current.rd)||text(redactionItem?.title).match(/RD\d+/i)?.[0]||'';
 const pe=text(current.pe);
 const tasks=[];
 if(redactionItem||rd){
  tasks.push({
   id:'redaction',
   label:rd?`Produzir ${rd}`:'Produzir redação vinculada',
   detail:text(redactionItem?.detail)||`${pe||'O PE atual'} possui uma redação vinculada.`,
   done:redactionItem?redactionItem.done===true:false,
   href:`${base}redacoes/?${new URLSearchParams({...(rd?{rd}:{}),...(pe?{pe}:{})})}`
  });
 }
 if(reviewItem||current.review24===false||current.review72===false){
  const done=reviewItem?reviewItem.done===true:Boolean(current.review24&&current.review72);
  tasks.push({
   id:'official-reviews',
   label:'Prioridade de revisão externa',
   detail:'O ciclo registra a necessidade de revisão, mas a execução acontece fora do TDAS. Use Prioridades para escolher o foco.',
   done,
   href:`${base}revisar/`
  });
 }
 if(nextPe){
  tasks.push({
   id:'next',
   label:`Preparar ${text(nextPe.pe)||'próximo PE'}`,
   detail:text(nextPe.title)||'Próxima atividade oficial do ciclo.',
   done:false,
   href:`${base}estudar/?pe=${encodeURIComponent(text(nextPe.pe))}`
  });
 }
 return tasks;
}

export function selectPrimaryAction({pe,progress={},draft,attempt,nextPe,overduePe,officialCompleted,officialTasks=[],base='/'}={}){
 if(draft&&text(draft.peId).toUpperCase()===text(pe).toUpperCase()){
  const index=Number(draft.session?.currentIndex||0)+1,total=Array.isArray(draft.session?.questionIds)?draft.session.questionIds.length:0;
  return{stage:'questions',label:`Continuar questão ${index} de ${total}`,detail:'Existe uma sessão interrompida neste dispositivo.',href:`${base}resolver/?pe=${encodeURIComponent(pe)}&resume=1`,button:'Continuar de onde parei'};
 }
 const currentStarted=Boolean(progress.material||progress.questions||progress.registered||attempt);
 if(!officialCompleted&&overduePe&&!currentStarted){
  const overdueId=text(overduePe.pe),status=text(overduePe.status)||'pendente';
  return{stage:'overdue',label:`Retomar ${overdueId} — ${text(overduePe.title)||'atividade pendente'}`,detail:`${overdueId} venceu em ${text(overduePe.date)||'data anterior'} e ainda consta como ${status}.`,href:`${base}estudar/?pe=${encodeURIComponent(overdueId)}`,button:'Retomar PE atrasado'};
 }
 const pendingRedaction=officialTasks.find(item=>item.id==='redaction'&&pending(item));
 if(officialCompleted&&pendingRedaction)return{stage:'redaction',label:pendingRedaction.label,detail:`${pe} foi concluído, mas o fechamento discursivo ainda está pendente.`,href:pendingRedaction.href,button:'Abrir redação'};
 if(officialCompleted&&nextPe)return{stage:'next',label:`Preparar ${nextPe.pe}`,detail:`${pe} foi concluído oficialmente. Próxima atividade: ${nextPe.title||nextPe.pe}.`,href:`${base}estudar/?pe=${encodeURIComponent(nextPe.pe)}`,button:'Abrir próximo PE'};
 if(officialCompleted){
  const pendingOfficial=officialTasks.find(item=>pending(item));
  if(pendingOfficial)return{stage:pendingOfficial.id,label:pendingOfficial.label,detail:pendingOfficial.detail,href:pendingOfficial.href,button:pendingOfficial.id==='official-reviews'?'Ver prioridades':'Abrir pendência'};
  return{stage:'done',label:'Ciclo concluído',detail:`${pe} foi concluído oficialmente.`,href:`${base}desempenho/`,button:'Ver desempenho'};
 }
 if(!progress.material)return{stage:'material',label:`Começar material do ${pe}`,detail:'Primeiro passo: material premium e Lei Seca indicada.',href:`${base}estudar/?pe=${encodeURIComponent(pe)}`,button:'Começar material'};
 if(!progress.questions&&!attempt)return{stage:'questions',label:`Resolver questões do ${pe}`,detail:'O material foi marcado como concluído.',href:`${base}resolver/?pe=${encodeURIComponent(pe)}`,button:'Abrir questões'};
 if(!progress.registered)return{stage:'registered',label:`Fechar registro do ${pe}`,detail:'Confira desempenho e registre a execução oficial.',href:`${base}pe/${Number(String(pe).replace(/\D/g,''))||1}/`,button:'Fechar registro'};
 if(nextPe)return{stage:'next',label:`Preparar ${nextPe.pe}`,detail:`${nextPe.title||'Próxima atividade do ciclo'}.`,href:`${base}estudar/?pe=${encodeURIComponent(nextPe.pe)}`,button:'Abrir próximo PE'};
 return{stage:'done',label:'Ciclo concluído',detail:'Todas as etapas locais estão concluídas.',href:`${base}desempenho/`,button:'Ver desempenho'};
}
