export const ATTEMPT_EXPORT_SCHEMA='1.1.0';
const BASE='/sedes-tdas-dashboard/';
const iso=value=>value==null?null:new Date(Number(value)).toISOString();
const text=value=>value==null?null:String(value);
const copyObject=value=>value&&typeof value==='object'?JSON.parse(JSON.stringify(value)):value;
const safeKeyPath=path=>/^data\/integration\/question-keys\/(?:[a-z0-9._-]+|master\/[a-z0-9._-]+)\.json$/i.test(String(path||''));
function telemetryOf(result){const t=result?.telemetry||{};return{activeMs:Number(t.activeMs||0),visits:Number(t.visits||0),answerChanges:Number(t.answerChanges||0),firstAnswer:text(t.firstAnswer),lastAnswer:text(t.lastAnswer||result?.selected),firstAnsweredAt:t.firstAnsweredAt==null?null:iso(t.firstAnsweredAt),lastAnsweredAt:t.lastAnsweredAt==null?null:iso(t.lastAnsweredAt),answerHistory:Array.isArray(t.answerHistory)?copyObject(t.answerHistory):null,historyComplete:t.historyComplete===true}}
const alternativeText=(alternativas,key)=>key&&alternativas?.[key]!=null?String(alternativas[key]):null;
export function diagnoseQuestion(q){
 const signals=[];
 if(q.issue==='annulment_pending')signals.push('Você sinalizou possível anulação; trate o item como pendente de validação, não como erro consolidado.');
 if(q.issue==='source_error')signals.push('Você sinalizou possível erro da fonte; o gabarito precisa de validação antes de virar erro de estudo.');
 if(!q.correct&&q.issue==='none'){
  if(q.confidence==='guess')signals.push('Chute incorreto: a resposta foi marcada sem segurança e não coincidiu com o gabarito.');
  else if(q.confidence==='doubt')signals.push('Dúvida não resolvida: você já havia indicado insegurança antes da correção.');
  else signals.push('Erro com alta confiança: você marcou segurança, mas a resposta divergiu do gabarito; vale revisar a regra e a leitura do comando.');
 }else if(q.correct&&q.confidence==='guess')signals.push('Acerto por chute: o resultado foi correto, mas ainda não comprova domínio.');
 else if(q.correct&&q.confidence==='doubt')signals.push('Acerto com dúvida: a resposta foi correta, porém a insegurança justifica revisão.');
 if(Number(q.answerChanges)>0)signals.push(`Você alterou a resposta ${Number(q.answerChanges)} vez(es); confira se houve hesitação entre conceitos próximos.`);
 if(Number(q.visits)>1)signals.push(`A questão foi visitada ${Number(q.visits)} vezes; isso pode indicar dificuldade de decisão ou revisão consciente.`);
 if(q.marked)signals.push('Você marcou esta questão para revisão.');
 return signals.join(' ');
}
export function buildAttemptExport({attempt,questionsById={},user={},source='local'}={}){
 if(!attempt?.id||!Array.isArray(attempt.questionResults))throw new TypeError('Tentativa inválida para exportação.');
 const questions=attempt.questionResults.map(result=>{
  const external=questionsById[result.id]||{},snapshot={...result,...external},telemetry=telemetryOf(result),alternativas=copyObject(snapshot.alternativas||null),selected=text(result.selected),correctAnswer=text(result.correctAnswer);
  const q={id:String(result.id),peId:attempt.peId||null,codigo:text(snapshot.codigo),numeroOriginal:result.numeroOriginal??snapshot.numeroOriginal??snapshot.numero_original??snapshot.numero??null,materia:text(snapshot.materia??snapshot.disciplina),assunto:text(result.assunto??snapshot.assunto),subassunto:text(result.subassunto??snapshot.subassunto),textoBase:text(snapshot.textoBase??snapshot.texto_base),enunciado:text(snapshot.enunciado),alternativas,selected,selectedText:text(snapshot.selectedText??alternativeText(alternativas,selected)),correctAnswer,correctText:text(snapshot.correctText??alternativeText(alternativas,correctAnswer)),correct:result.correct===true,confidence:text(result.confidence||'secure'),marked:result.marked===true,classification:text(result.classification),issue:text(result.issue||'none'),sourcePe:text(snapshot.sourcePe),sourceTitle:text(snapshot.sourceTitle),sourceKind:text(snapshot.sourceKind),sourceKeyPath:text(snapshot.sourceKeyPath),sourcePublicPath:text(snapshot.sourcePublicPath),materialId:text(snapshot.materialId),materialName:text(snapshot.materialName),tipoMaterial:text(snapshot.tipoMaterial??snapshot.tipo_material),banca:text(snapshot.banca??snapshot.fonte),ano:snapshot.ano==null?null:Number(snapshot.ano),orgao:text(snapshot.orgao),cargo:text(snapshot.cargo),codigoCargo:text(snapshot.codigoCargo??snapshot.codigo_cargo),dificuldade:text(snapshot.dificuldade),formatoQuestao:text(snapshot.formatoQuestao??snapshot.formato_questao),comentario:text(snapshot.comentario),fundamento:text(snapshot.fundamento??snapshot.justificativa),pegadinha:text(snapshot.pegadinha),comentariosAlternativas:copyObject(snapshot.comentariosAlternativas??snapshot.comentarios_alternativas??null),fonteOficial:text(snapshot.fonteOficial??snapshot.fonte_oficial),observacoes:text(snapshot.observacoes),...telemetry};
  return{...q,diagnostico:diagnoseQuestion(q)};
 });
 return{schemaVersion:ATTEMPT_EXPORT_SCHEMA,exportedAt:new Date().toISOString(),source,user:copyObject(user),attempt:{id:String(attempt.id),peId:attempt.peId||null,mode:attempt.mode||'study',startedAt:iso(attempt.startedAt),finishedAt:iso(attempt.finishedAt),elapsedMs:Number(attempt.elapsedMs||0),activeElapsedMs:attempt.activeElapsedMs==null?null:Number(attempt.activeElapsedMs),correct:Number(attempt.correct||0),incorrect:Number(attempt.incorrect||0),total:Number(attempt.total||0),percent:Number(attempt.percent||0),revisitCount:Number(attempt.revisitCount||0),answerChangeCount:Number(attempt.answerChangeCount||0),catalogId:attempt.catalogId||attempt.materialId||null,deviceId:attempt.deviceId||null},questions};
}
export function validateAttemptExport(value){
 if(!value||!['1.0.0','1.1.0'].includes(value.schemaVersion)||!value.attempt?.id||!Array.isArray(value.questions))throw new TypeError('Exportação de tentativa incompatível.');
 if(value.questions.length!==Number(value.attempt.total))throw new Error('Quantidade de questões divergente na exportação.');
 const ids=new Set();for(const item of value.questions){if(!item?.id||ids.has(item.id))throw new Error('Questão ausente ou duplicada na exportação.');ids.add(item.id);if(typeof item.correct!=='boolean')throw new Error(`Resultado inválido em ${item.id}.`)}
 return value;
}
export async function enrichAttemptExportWithCorrections(exported,{fetchFn=globalThis.fetch,base=BASE}={}){
 const data=validateAttemptExport(exported),paths=[...new Set(data.questions.map(q=>q.sourceKeyPath).filter(safeKeyPath))];if(!paths.length||typeof fetchFn!=='function')return data;
 const maps=[];
 for(const path of paths){try{const response=await fetchFn(base+path,{cache:'no-store'});if(!response.ok)continue;const payload=await response.json(),map=new Map((payload.answers||[]).filter(x=>x?.id).map(x=>[String(x.id),x]));maps.push(map)}catch{}}
 if(!maps.length)return data;
 const questions=data.questions.map(q=>{let detail=null;for(const map of maps){if(map.has(q.id)){detail=map.get(q.id);break}}if(!detail)return q;const next={...q,comentario:text(detail.comentario??q.comentario),fundamento:text(detail.fundamento??q.fundamento),pegadinha:text(detail.pegadinha??q.pegadinha),comentariosAlternativas:copyObject(detail.comentariosAlternativas??detail.comentarios_alternativas??q.comentariosAlternativas),fonteOficial:text(detail.fonteOficial??detail.fonte_oficial??q.fonteOficial),observacoes:text(detail.observacoes??q.observacoes)};return{...next,diagnostico:diagnoseQuestion(next)}});
 return{...data,schemaVersion:ATTEMPT_EXPORT_SCHEMA,questions};
}
const labelConfidence=value=>value==='guess'?'chute':value==='doubt'?'dúvida':'segurança';
const ms=value=>`${Math.max(0,Math.round(Number(value||0)/1000))}s`;
const detailBlock=(q,index)=>{
 const alternatives=Object.entries(q.alternativas||{}).map(([k,v])=>`- ${k}) ${v}`).join('\n');
 return[`### ${index+1}. Questão ${q.numeroOriginal??q.id} — ${q.materia||q.assunto||'sem matéria'}`,q.subassunto?`**Subassunto:** ${q.subassunto}`:'',q.enunciado?`**Enunciado:** ${q.enunciado}`:'',q.textoBase?`**Texto-base:** ${q.textoBase}`:'',alternatives,`**Minha resposta:** ${q.selected||'—'}${q.selectedText?` — ${q.selectedText}`:''}`,`**Gabarito:** ${q.correctAnswer||'—'}${q.correctText?` — ${q.correctText}`:''}`,`**Resultado:** ${q.correct?'ACERTO':'ERRO'} · confiança: ${labelConfidence(q.confidence)} · tempo ativo: ${ms(q.activeMs)} · visitas: ${q.visits||0} · trocas: ${q.answerChanges||0}`,q.diagnostico?`**Diagnóstico comportamental:** ${q.diagnostico}`:'',q.comentario?`**Comentário editorial:** ${q.comentario}`:'',q.fundamento?`**Fundamento:** ${q.fundamento}`:'',q.pegadinha?`**Pegadinha:** ${q.pegadinha}`:'',q.fonteOficial?`**Fonte oficial:** ${q.fonteOficial}`:''].filter(Boolean).join('\n\n');
};
export function buildChatGptSummary(exported,{risk=[]}={}){
 const data=validateAttemptExport(exported),a=data.attempt,wrong=data.questions.filter(q=>!q.correct),attention=data.questions.filter(q=>!q.correct||q.confidence!=='secure'||q.marked||q.issue!=='none'),focus=attention.length?attention:data.questions.slice(0,Math.min(5,data.questions.length)),topics=[...new Set(data.questions.map(q=>q.subassunto||q.assunto||q.materia).filter(Boolean))];
 const lines=['# Relatório TDAS para análise no ChatGPT',`**Tentativa:** ${a.peId||'sessão'} · ${a.id}`,`**Resultado:** ${a.correct}/${a.total} · ${Number(a.percent).toFixed(1)}%`,`**Tempo:** ${ms(a.elapsedMs)} total · ${a.activeElapsedMs==null?'não medido':ms(a.activeElapsedMs)} ativo`,`**Erros:** ${wrong.length} · **Itens para atenção:** ${attention.length}`,`**Matérias/assuntos:** ${topics.join(' · ')||'não informado'}`];
 if(risk.length)lines.push(`**Mapa de risco atual:** ${risk.map(item=>`${item.topic}=${item.riskScore}`).join(' · ')}`);
 lines.push('\n## Instrução para análise','Analise somente com base nos dados abaixo e em fontes oficiais quando precisar complementar. Para cada erro ou acerto inseguro: (1) explique por que minha resposta está errada ou insuficiente; (2) explique por que o gabarito está correto; (3) identifique a regra/conceito que faltou; (4) classifique o provável tipo de falha entre conteúdo, interpretação, distração, dúvida entre conceitos ou chute, deixando claro quando for hipótese; (5) produza uma micro-revisão objetiva e uma pegadinha de prova; (6) sugira um flashcard curto. Se houver sinalização de possível anulação ou erro da fonte, não trate o gabarito como definitivo sem validar. Não invente fundamento ausente.','\n## Questões prioritárias',...focus.map(detailBlock));return lines.join('\n\n');
}
