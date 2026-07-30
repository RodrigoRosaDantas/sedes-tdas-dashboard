import { compact, norm } from './config.mjs';

const text = value => Array.isArray(value) ? value.join(', ') : String(value ?? '').trim();
const num = value => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};
const bool = value => value === true || ['sim', 'true', 'yes', 'concluido', 'concluida', 'revisado', 'revisada'].includes(norm(value));

export function prop(record, aliases) {
  const entries = Object.entries(record.properties || {});
  for (const alias of aliases) {
    const hit = entries.find(([name]) => compact(name) === compact(alias));
    if (hit) return hit[1];
  }
  for (const alias of aliases) {
    const target = compact(alias);
    if (target.length < 5) continue;
    const hit = entries.find(([name]) => compact(name).includes(target) || target.includes(compact(name)));
    if (hit) return hit[1];
  }
  return null;
}

export function propId(record, aliases) {
  const entries = Object.entries(record.propertyIds || {});
  for (const alias of aliases) {
    const hit = entries.find(([name]) => compact(name) === compact(alias));
    if (hit) return hit[1];
  }
  return null;
}

function exactCode(record, aliases, prefix) {
  const raw = text(prop(record, aliases)).toUpperCase();
  return new RegExp(`^${prefix}[0-9]+$`).test(raw) ? raw : '';
}

function patterns(record) {
  const primary = prop(record, ['Padrão do erro']);
  const values = Array.isArray(primary) ? primary : primary ? [primary] : [];
  return [...new Set(values.map(text).filter(Boolean))];
}

export function control(record) {
  const pe = exactCode(record, ['Dia ID'], 'PE');
  const status = text(prop(record, ['Status', 'Situação', 'Resultado automático']));
  const qg = num(prop(record, ['Questões gerais', 'Q gerais'])) ?? 0;
  const qe = num(prop(record, ['Questões específicas', 'Q específicas'])) ?? 0;
  const ag = num(prop(record, ['Acertos gerais']));
  const ae = num(prop(record, ['Acertos específicas', 'Acertos específicos']));
  const acertos = num(prop(record, ['Acertos'])) ?? ((ag != null || ae != null) ? (ag || 0) + (ae || 0) : null);
  const attempted = num(prop(record, ['Questões feitas', 'Questões concluídas'])) ?? qg + qe;
  const rd = exactCode(record, ['RD ID'], 'RD');
  return {
    id: record.id,
    pe,
    date: text(prop(record, ['Data'])).slice(0, 10),
    week: num(prop(record, ['Semana'])) ?? null,
    title: record.title.replace(/^\s*PE\s*\d+\s*[—–-]\s*/i, '').trim() || record.title,
    status,
    meta: num(prop(record, ['Meta de questões', 'Meta'])) ?? attempted,
    qg,
    qe,
    ag,
    ae,
    acertos,
    attempted,
    block: text(prop(record, ['Bloco predominante', 'Bloco do dia', 'Bloco'])),
    typ: text(prop(record, ['Tipo', 'Tipo do dia', 'Natureza'])),
    source: text(prop(record, ['Fonte do estudo', 'Fonte'])),
    rd,
    redacao: bool(prop(record, ['Redação?', 'Tem redação?'])) || Boolean(rd),
    review24: bool(prop(record, ['Revisão 24h feita?', 'Revisão 24h', 'Revisado 24h?'])),
    review72: bool(prop(record, ['Revisão 72h feita?', 'Revisão 72h', 'Revisado 72h?'])),
    efficiency: text(prop(record, ['Eficiência'])),
    action: text(prop(record, ['Ação recomendada'])),
    url: record.url,
    last_edited_time: record.last_edited_time
  };
}

export function error(record, completeSummary = '', markdown = '') {
  const questionError = text(record.title);
  return {
    id: record.id,
    questionError,
    origin: exactCode(record, ['Origem / Dia ID'], 'PE'),
    title: questionError.replace(/^\s*❌?\s*Erro\s*\d*\s*[—–-]\s*/i, '').trim() || questionError,
    subject: text(prop(record, ['Matéria', 'Disciplina', 'Assunto'])) || 'Não classificado',
    theme: text(prop(record, ['Tema'])),
    subtheme: text(prop(record, ['Subtema'])),
    severity: text(prop(record, ['Gravidade', 'Prioridade TDAS'])) || 'Não informada',
    recurrence: num(prop(record, ['Reincidência', 'Reincidencia', 'Recorrência', 'Recorrencia'])) ?? 0,
    patterns: patterns(record),
    flashcard: bool(prop(record, ['Flashcard?', 'Flashcard'])),
    reviewed: bool(prop(record, ['Revisado?'])),
    date: (text(prop(record, ['Data', 'Data automática — pelo Dia ID'])) || record.created_time || '').slice(0, 10),
    summary: completeSummary || text(prop(record, ['Resumo'])) || markdown || '',
    url: record.url,
    last_edited_time: record.last_edited_time,
    markdown
  };
}

export function redaction(record) {
  const rd = exactCode(record, ['RD ID'], 'RD');
  const rdNumber = Number(rd.replace(/\D/g, ''));
  const status = text(prop(record, ['Status', 'Resultado automático', 'Situação', 'Estado da versão']));
  const corrected = bool(prop(record, ['Diagnóstico feito?', 'Corrigida?', 'Correção feita?'])) || /(corrigid|diagnosticad|reescrit)/i.test(norm(status));
  return {
    id: record.id,
    rd,
    pe: '',
    week: num(prop(record, ['Semana'])) ?? (rdNumber ? Math.ceil(rdNumber / 2) : null),
    date: text(prop(record, ['Data'])).slice(0, 10),
    theme: text(prop(record, ['Tema'])) || record.title.replace(/^\s*RD\s*\d+\s*[—–-]\s*/i, '').trim() || record.title,
    status: status || (corrected ? 'Diagnosticada' : 'Não iniciada'),
    corrected,
    score: num(prop(record, ['Nota estimada', 'Pontuação estratégica', 'Nota'])),
    url: record.url,
    last_edited_time: record.last_edited_time
  };
}
