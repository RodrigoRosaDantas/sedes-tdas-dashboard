export const ERROR_BOOK_EXPORT_SCHEMA='1.0.0';
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
export function buildErrorOccurrence({attemptExport,question,errorCause=null}={}){
 if(!attemptExport?.attempt?.id||!question?.id)throw new TypeError('Ocorrência inválida para exportação.');
 return{attemptId:attemptExport.attempt.id,peId:attemptExport.attempt.peId,occurredAt:attemptExport.attempt.finishedAt,question:clone(question),errorCause:clone(errorCause),source:attemptExport.source||null};
}
export function buildErrorBookExport(occurrences,user={}){return{schemaVersion:ERROR_BOOK_EXPORT_SCHEMA,type:'tdas-error-book',exportedAt:new Date().toISOString(),user:clone(user),occurrences:(occurrences||[]).map(clone)}}
export function validateErrorBookExport(value){if(!value||value.schemaVersion!==ERROR_BOOK_EXPORT_SCHEMA||value.type!=='tdas-error-book'||!Array.isArray(value.occurrences))throw new TypeError('Exportação do Caderno de Erros incompatível.');for(const item of value.occurrences)if(!item?.attemptId||!item?.question?.id)throw new Error('Ocorrência incompleta na exportação.');return value}
export function errorBookSummary(value){const data=validateErrorBookExport(value),wrong=data.occurrences.filter(item=>item.question.correct===false),doubt=data.occurrences.filter(item=>item.question.confidence==='doubt'),guess=data.occurrences.filter(item=>item.question.confidence==='guess'),changed=data.occurrences.filter(item=>Number(item.question.answerChanges)>0);return[`Caderno de Erros TDAS · ${data.occurrences.length} ocorrências`,`Erros confirmados: ${wrong.length}`,`Com dúvida: ${doubt.length}`,`Por chute: ${guess.length}`,`Com troca de resposta: ${changed.length}`,'Dados completos:',JSON.stringify(data.occurrences,null,2)].join('\n')}
