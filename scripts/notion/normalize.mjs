import { compact, norm } from './config.mjs';

const text = v => Array.isArray(v) ? v.join(', ') : String(v ?? '').trim();
const num = v => { if (typeof v === 'number' && Number.isFinite(v)) return v; const n = Number(String(v ?? '').replace(',', '.').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : null; };
const bool = v => v === true || ['sim','true','yes','concluido','concluida'].includes(norm(v));
function prop(r, aliases) {
  const entries = Object.entries(r.properties || {});
  for (const a of aliases) { const hit = entries.find(([n]) => compact(n) === compact(a)); if (hit) return hit[1]; }
  for (const a of aliases) { const t=compact(a); const hit=entries.find(([n]) => compact(n).includes(t) || t.includes(compact(n))); if (hit) return hit[1]; }
  return null;
}
function code(r, prefix) {
  const rx = new RegExp(`\\b${prefix}\\s*0*(\\d{1,3})\\b`, 'i');
  for (const v of [r.title, ...Object.values(r.properties || {}).flatMap(x => Array.isArray(x) ? x : [x])]) { const m=String(v ?? '').match(rx); if(m)return `${prefix.toUpperCase()}${String(Number(m[1])).padStart(2,'0')}`; }
  return '';
}
export function control(r) {
  const pe=code(r,'PE')||text(prop(r,['Dia ID','PE','Caso ID'])); const status=text(prop(r,['Status','Situação','Resultado automático']));
  const qg=num(prop(r,['Questões gerais','Q gerais']))??0, qe=num(prop(r,['Questões específicas','Q específicas']))??0;
  const ag=num(prop(r,['Acertos gerais'])), ae=num(prop(r,['Acertos específicas','Acertos específicos']));
  const acertos=num(prop(r,['Acertos']))??((ag!=null||ae!=null)?(ag||0)+(ae||0):null);
  const attempted=num(prop(r,['Questões feitas','Questões concluídas']))??qg+qe;
  const rd=code(r,'RD')||text(prop(r,['Redação ID','RD','Redação']));
  return { id:r.id, pe, date:text(prop(r,['Data'])).slice(0,10), title:r.title.replace(/^\s*PE\s*\d+\s*[—–-]\s*/i,'').trim()||r.title, status, meta:num(prop(r,['Meta de questões','Meta']))??attempted, qg, qe, ag, ae, acertos, attempted, block:text(prop(r,['Bloco predominante','Bloco do dia','Bloco'])), typ:text(prop(r,['Tipo do dia','Tipo','Natureza'])), source:text(prop(r,['Fonte do estudo','Fonte'])), rd, redacao:Boolean(rd)||bool(prop(r,['Redação?','Tem redação?'])), review24:bool(prop(r,['Revisão 24h','Revisado 24h?'])), review72:bool(prop(r,['Revisão 72h','Revisado 72h?'])), efficiency:text(prop(r,['Eficiência'])), action:text(prop(r,['Ação recomendada'])), url:r.url, last_edited_time:r.last_edited_time };
}
function patterns(r) { const out=[]; for(const [n,v] of Object.entries(r.properties||{})){ if(!/(padrao|categoria|tema|subtema|topico|tag|assunto|tipo do erro)/i.test(norm(n)))continue; for(const x of Array.isArray(v)?v:[v])if(text(x))out.push(text(x)); } return [...new Set(out)]; }
export function error(r, markdown='') { return { id:r.id, origin:code(r,'PE')||text(prop(r,['Origem / Dia ID','Origem','Dia ID'])), title:r.title.replace(/^\s*❌?\s*Erro\s*\d*\s*[—–-]\s*/i,'').trim()||r.title, fullTitle:r.title, subject:text(prop(r,['Matéria','Disciplina','Assunto']))||'Não classificado', severity:text(prop(r,['Gravidade','Prioridade TDAS']))||'Não informada', recurrence:num(prop(r,['Reincidência','Reincidencia','Recorrência','Recorrencia']))??0, flashcard:bool(prop(r,['Flashcard?','Flashcard'])), date:(text(prop(r,['Data','Data automática — pelo Dia ID']))||r.created_time||'').slice(0,10), patterns:patterns(r), url:r.url, last_edited_time:r.last_edited_time, markdown }; }
export function redaction(r) { const rd=code(r,'RD')||text(prop(r,['RD','Redação ID','ID'])), pe=code(r,'PE')||text(prop(r,['PE','Origem / Dia ID','Dia ID'])); const n=Number(rd.replace(/\D/g,'')); const status=text(prop(r,['Status','Resultado automático','Situação','Estado da versão'])); const corrected=bool(prop(r,['Diagnóstico feito?','Corrigida?','Correção feita?']))||/(corrigid|diagnosticad|conclu)/i.test(norm(status)); return { id:r.id, rd, pe, week:num(prop(r,['Semana']))??(n?Math.ceil(n/2):null), date:text(prop(r,['Data'])).slice(0,10), theme:text(prop(r,['Tema','Título','Proposta']))||r.title.replace(/^\s*RD\s*\d+\s*[—–-]\s*/i,'').trim()||r.title, status:status||(corrected?'Diagnosticada':'Não iniciada'), corrected, score:num(prop(r,['Nota estimada','Pontuação estratégica','Nota'])), url:r.url, last_edited_time:r.last_edited_time }; }
