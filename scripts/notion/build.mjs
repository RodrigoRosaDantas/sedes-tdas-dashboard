import { EXAM_DATE, API_VERSION, norm, round, slugify, sourceList, weeksBetween } from './config.mjs';

const done = status => !/nao concluid|incomplet/.test(norm(status)) && /concluid|finalizad|feito|realizad/.test(norm(status));
const explicitlyPending = status => /nao iniciad|planejad|a fazer|pendente|futuro/.test(norm(status));
const started = status => !explicitlyPending(status) && (done(status) || /andamento|parcial|iniciad|objetiva/.test(norm(status)));
const codeNumber = code => Number(String(code || '').replace(/\D/g, '')) || 0;
const byCode = (a, b) => codeNumber(a.pe || a.rd) - codeNumber(b.pe || b.rd) || String(a.url).localeCompare(String(b.url));
const byDate = (a, b) => String(a.date || '').localeCompare(String(b.date || '')) || byCode(a, b);
const accuracy = item => item.acertos != null && item.attempted > 0 ? round(item.acertos / item.attempted * 100) : null;
const weekOf = item => item.week || Math.ceil(codeNumber(item.pe) / 7) || null;
const meta = date => ({
  snapshotDate: date,
  examDate: EXAM_DATE,
  syncTimes: ['00h50', '06h50', '12h50', '18h50'],
  version: '20.3',
  sources: sourceList()
});

function publicControl(item, errors) {
  return {
    pe: item.pe,
    number: codeNumber(item.pe),
    week: weekOf(item),
    date: item.date,
    title: item.title,
    status: item.status,
    meta: item.meta,
    qg: item.qg,
    qe: item.qe,
    ag: item.ag,
    ae: item.ae,
    acertos: item.acertos,
    attempted: item.attempted,
    errors: errors.filter(error => error.origin === item.pe).length,
    block: item.block,
    typ: item.typ,
    type: item.typ,
    source: item.source,
    rd: item.rd,
    redacao: item.redacao,
    review24: item.review24,
    review72: item.review72,
    efficiency: item.efficiency,
    action: item.action,
    url: item.url,
    accuracy: accuracy(item),
    quality_flags: [],
    layer: 'Execução operacional — Notion'
  };
}

function publicFuture(item) {
  return {
    pe: item.pe,
    number: codeNumber(item.pe),
    week: weekOf(item),
    date: item.date,
    title: item.title,
    planned_questions: item.meta == null ? '' : String(item.meta),
    rd: item.rd,
    status: item.status,
    type: item.typ || item.block,
    source: item.source,
    url: item.url
  };
}

function qualityIssues(controls, errors, redactions) {
  const issues = [];
  for (const item of controls) {
    if (!item.date) issues.push({ severity: 'medium', pe: item.pe, title: 'Data ausente', detail: 'O registro não possui Data preenchida no Controle de Questões.', url: item.url });
    if (!item.title) issues.push({ severity: 'medium', pe: item.pe, title: 'Atividade ausente', detail: 'O título da atividade está vazio no Controle de Questões.', url: item.url });
    if (!item.status) issues.push({ severity: 'medium', pe: item.pe, title: 'Status ausente', detail: 'O campo de status não foi preenchido; nenhum estado foi presumido.', url: item.url });
    if (item.meta > 0 && item.attempted > 0 && item.meta !== item.attempted) {
      issues.push({ severity: 'high', pe: item.pe, title: 'Meta e distribuição não fecham', detail: `Meta registrada: ${item.meta}; questões registradas: ${item.attempted}.`, url: item.url });
    }
    if (done(item.status) && item.attempted > 0 && item.acertos == null) {
      issues.push({ severity: 'medium', pe: item.pe, title: 'Dia concluído sem resultado', detail: `Há ${item.attempted} questões registradas, mas o campo Acertos está ausente.`, url: item.url });
    }
  }
  for (const item of errors) {
    const missing = [];
    if (!item.subject || item.subject === 'Não classificado') missing.push('Matéria');
    if (!item.origin) missing.push('Origem / Dia ID');
    if (!item.date) missing.push('Data');
    if (!item.summary) missing.push('Resumo');
    if (missing.length) issues.push({ severity: 'medium', pe: item.origin || 'Erro', title: 'Registro incompleto no Caderno de Erros', detail: `Campos ausentes: ${missing.join(', ')}.`, url: item.url });
  }
  for (const item of redactions) {
    const missing = [];
    if (!item.date) missing.push('Data');
    if (!item.theme) missing.push('Tema');
    if (!item.status) missing.push('Status');
    if (missing.length) issues.push({ severity: 'medium', pe: item.rd, title: 'Redação com campo ausente', detail: `Campos ausentes: ${missing.join(', ')}.`, url: item.url });
  }
  return issues;
}

function subjectGroups(errors) {
  const groups = new Map();
  for (const error of errors) {
    const subject = error.subject || 'Não classificado';
    if (!groups.has(subject)) groups.set(subject, {
      subject, errors: 0, recurrent: 0, high_critical: 0, flashcards: 0,
      latest_date: '', patterns: new Map(), timeline: new Map()
    });
    const group = groups.get(subject);
    group.errors++;
    if (error.recurrence > 0) group.recurrent++;
    if (['alta', 'critica'].includes(norm(error.severity))) group.high_critical++;
    if (error.flashcard) group.flashcards++;
    if (error.date > group.latest_date) group.latest_date = error.date;
    if (error.date) group.timeline.set(error.date, (group.timeline.get(error.date) || 0) + 1);
    for (const pattern of error.patterns || []) group.patterns.set(pattern, (group.patterns.get(pattern) || 0) + 1);
  }
  return [...groups.values()].sort((a, b) => b.errors - a.errors || a.subject.localeCompare(b.subject));
}

function recommendation(group, topPatterns) {
  const list = topPatterns.slice(0, 3).map(item => item.pattern).join(', ') || 'os registros mais recentes';
  if (group.errors >= 20) return `Prioridade máxima: retome diariamente ${list} e use os ${group.flashcards} flashcards registrados como revisão ativa.`;
  if (group.errors >= 10) return `Reforço semanal: concentre a revisão em ${list} e acompanhe a reincidência após cada PE.`;
  return `Manutenção dirigida: revise ${list} antes do próximo bloco relacionado.`;
}

function weeklyRows(actual) {
  const map = new Map();
  for (const row of actual) {
    const week = row.week || Math.ceil(row.number / 7);
    if (!map.has(week)) map.set(week, { week, rows: 0, completed: 0, result_days: 0, meta_completed: 0, meta_with_result: 0, correct: 0, linked_errors: 0, missing_result_days: 0 });
    const current = map.get(week);
    current.rows++;
    if (done(row.status)) {
      current.completed++;
      current.meta_completed += Number(row.attempted || row.meta || 0);
      if (row.acertos != null && row.attempted > 0) {
        current.result_days++;
        current.meta_with_result += row.attempted;
        current.correct += row.acertos;
      } else if (row.attempted > 0) current.missing_result_days++;
    }
    current.linked_errors += row.errors || 0;
  }
  return [...map.values()].sort((a, b) => a.week - b.week).map(row => ({ ...row, accuracy: row.meta_with_result ? round(row.correct / row.meta_with_result * 100) : 0 }));
}

function blockRows(actual) {
  const map = new Map();
  for (const row of actual.filter(item => item.acertos != null && item.attempted > 0)) {
    const block = row.block || row.typ || 'Não classificado';
    if (!map.has(block)) map.set(block, { block, days: 0, meta: 0, correct: 0, errors: 0 });
    const current = map.get(block);
    current.days++;
    current.meta += row.attempted;
    current.correct += row.acertos;
    current.errors += row.errors || 0;
  }
  return [...map.values()].map(row => ({ ...row, accuracy: row.meta ? round(row.correct / row.meta * 100) : 0 })).sort((a, b) => b.meta - a.meta || a.block.localeCompare(b.block));
}

function simulations(controls) {
  return controls.filter(item => /simulado|prova/i.test(`${item.title} ${item.block} ${item.typ}`)).map(item => ({
    id: item.pe,
    title: item.title,
    date: item.date,
    result: item.acertos != null && item.attempted > 0 ? `${item.acertos}/${item.attempted}` : '—',
    score: accuracy(item) == null ? '—' : `${accuracy(item).toFixed(2).replace('.', ',')}%`,
    status: item.status || 'Não informado',
    url: item.url
  }));
}

function split(items, count) {
  const result = [];
  const size = Math.ceil(items.length / count) || 1;
  for (let index = 0; index < count; index++) result.push(items.slice(index * size, (index + 1) * size));
  return result;
}

function publicError(error) {
  return {
    questaoErro: error.questionError,
    materia: error.subject,
    origem: error.origin,
    data: error.date,
    gravidade: error.severity,
    reincidencia: error.recurrence,
    padraoErro: error.patterns,
    tema: error.theme,
    subtema: error.subtheme,
    flashcard: error.flashcard,
    revisado: error.reviewed,
    url: error.url,
    resumo: error.summary
  };
}

export function build(controls, errors, redactions, date, syncedAt) {
  const sortedControls = [...controls].sort(byCode);
  const sortedErrors = [...errors].sort(byDate);
  const sortedRedactions = [...redactions].sort(byCode);
  const completedControls = sortedControls.filter(item => done(item.status));
  const activeControls = sortedControls.filter(item => started(item.status));
  const actualControls = sortedControls.filter(item => started(item.status) || Boolean(item.date && item.date < date));
  const futureControls = sortedControls.filter(item => !started(item.status) && Boolean(item.date && item.date >= date)).sort(byDate);
  const actual = actualControls.map(item => publicControl(item, errors));
  const future = futureControls.map(publicFuture);
  const results = actual.filter(item => item.acertos != null && item.attempted > 0);
  const resultQuestions = results.reduce((sum, item) => sum + item.attempted, 0);
  const correct = results.reduce((sum, item) => sum + item.acertos, 0);
  const completedQuestions = actual.filter(item => done(item.status)).reduce((sum, item) => sum + Number(item.attempted || item.meta || 0), 0);
  const totalPE = Math.max(112, ...sortedControls.map(item => codeNumber(item.pe)), 0);
  const groups = subjectGroups(errors);
  const subjectsPublic = groups.map(group => {
    const top = [...group.patterns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([pattern, count]) => ({ pattern, count }));
    return {
      subject: group.subject,
      slug: slugify(group.subject),
      errors: group.errors,
      recurrent: group.recurrent,
      high_critical: group.high_critical,
      flashcards: group.flashcards,
      latest_date: group.latest_date,
      top_patterns: top,
      timeline: [...group.timeline.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([timelineDate, count]) => ({ date: timelineDate, count })),
      recommendation: recommendation(group, top)
    };
  });
  const quality = qualityIssues(sortedControls, sortedErrors, sortedRedactions);
  const portuguese = groups.find(group => norm(group.subject) === 'portugues');
  const portShare = errors.length ? round((portuguese?.errors || 0) / errors.length * 100, 1) : 0;
  const high = errors.filter(item => norm(item.severity) === 'alta').length;
  const critical = errors.filter(item => norm(item.severity) === 'critica').length;
  const recurrent = errors.filter(item => item.recurrence > 0).length;
  const corrected = sortedRedactions.filter(item => item.corrected).length;
  const notStarted = Math.max(0, sortedRedactions.length - corrected);
  const weeks = round(weeksBetween(date, EXAM_DATE), 1);
  const perWeek = weeks ? round(notStarted / weeks, 1) : notStarted;
  const days = Math.max(1, Math.ceil((new Date(`${EXAM_DATE}T12:00:00-03:00`) - new Date(`${date}T12:00:00-03:00`)) / 86400000) + 1);
  const remaining = futureControls.length;
  const currentControl = sortedControls.find(item => item.date === date) || futureControls.find(item => item.date >= date) || activeControls.at(-1) || sortedControls.at(-1);
  const latestControl = [...completedControls].sort(byDate).at(-1) || activeControls.at(-1) || sortedControls.at(-1);
  const view = item => item ? publicControl(item, errors) : null;
  const alerts = [];
  if (portuguese) alerts.push({ level: 'critical', title: 'Português concentra o maior risco', detail: `${portuguese.errors} de ${errors.length} erros catalogados (${portShare.toFixed(1)}%). Priorize os padrões mais recorrentes.`, action: 'Abrir riscos', href: '/sedes-tdas-dashboard/riscos/?materia=Português' });
  const pendingResults = quality.filter(item => item.title === 'Dia concluído sem resultado').length;
  if (pendingResults) alerts.push({ level: 'warning', title: 'Resultados pendentes afetam as médias', detail: `${pendingResults} PE concluídos continuam sem Acertos preenchidos.`, action: 'Abrir auditoria', href: '/sedes-tdas-dashboard/auditoria/#qualidade' });
  if (notStarted) alerts.push({ level: 'warning', title: 'Ritmo discursivo precisa ser protegido', detail: `Restam ${notStarted} redações. Ritmo necessário: ${perWeek.toFixed(1)} por semana.`, action: 'Abrir redações', href: '/sedes-tdas-dashboard/redacoes/' });
  const home = {
    meta: meta(date),
    metrics: { completed: completedControls.length, totalPE, questions: completedQuestions, correct, accuracy: resultQuestions ? round(correct / resultQuestions * 100) : 0, errors: errors.length, redactions: sortedRedactions.length, calendarDays: days, operationalDays: days },
    today: view(currentControl),
    latest: view(latestControl),
    alerts,
    projections: [
      { label: 'Ritmo de PE', value: `${round(remaining / days, 2).toFixed(2)} PE/dia`, formula: `${remaining} PE não iniciados ÷ ${days} dias operacionais inclusivos` },
      { label: 'Ritmo de redações', value: `${perWeek.toFixed(1)}/semana`, formula: `${notStarted} redações não iniciadas ÷ ${weeks.toFixed(1)} semanas` },
      { label: 'Questões com resultado', value: resultQuestions.toLocaleString('pt-BR'), formula: 'Soma das questões dos PE com campo Acertos preenchido' }
    ]
  };
  const current = view(currentControl);
  const currentMeta = Number(current?.meta || current?.attempted || 0);
  const minimum90 = currentMeta ? Math.ceil(currentMeta * 0.9) : 0;
  const currentErrors = [...errors].filter(item => item.origin === current?.pe).sort(byDate);
  const latestErrors = [...errors].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.last_edited_time).localeCompare(String(a.last_edited_time))).slice(0, 7);
  const today = {
    meta: meta(date),
    current,
    minimum90,
    checklist: current ? [
      { title: `Concluir ${currentMeta || 'as'} questões`, detail: current.title, done: done(current.status) || current.attempted > 0 },
      { title: minimum90 ? `Buscar pelo menos ${minimum90} acertos` : 'Registrar a meta de acertos', detail: current.acertos != null ? `Resultado registrado: ${current.acertos}/${current.attempted}.` : 'Resultado ainda não preenchido na fonte oficial.', done: current.acertos != null && current.acertos >= minimum90 },
      { title: 'Registrar acertos e erros no Notion', detail: `${current.acertos ?? 'Acertos pendentes'}; ${currentErrors.length} erro(s) vinculado(s).`, done: current.acertos != null },
      { title: current.rd ? `Produzir ${current.rd}` : 'Verificar redação vinculada', detail: current.rd || 'Nenhuma redação vinculada no Controle.', done: current.rd ? Boolean(sortedRedactions.find(item => item.rd === current.rd)?.corrected) : true },
      { title: 'Programar revisão em 24h e 72h', detail: 'Marque as revisões somente quando forem executadas.', done: Boolean(current.review24 && current.review72) }
    ] : [],
    reviewFocus: [
      ...(current?.pe ? [{ title: `${current.pe} — revisão dirigida`, detail: currentErrors[0]?.title || 'Reveja os registros reais vinculados ao dia.', level: currentErrors.length ? 'warning' : 'info' }] : []),
      ...(subjectsPublic[0] ? [{ title: `${subjectsPublic[0].subject} — maior concentração`, detail: subjectsPublic[0].recommendation, level: 'critical' }] : [])
    ],
    recentErrors: latestErrors.map(item => ({ origin: item.origin, title: item.title, subject: item.subject, severity: item.severity, url: item.url })),
    notionUrl: current?.url || sourceList()[0].url
  };
  const weekly = weeklyRows(actual);
  const blocks = blockRows(actual);
  const recentCutoff = new Date(`${date}T12:00:00-03:00`); recentCutoff.setDate(recentCutoff.getDate() - 27);
  const recentResults = results.filter(item => item.date && new Date(`${item.date}T12:00:00-03:00`) >= recentCutoff);
  const recentQuestions = recentResults.reduce((sum, item) => sum + item.attempted, 0);
  const recentCorrect = recentResults.reduce((sum, item) => sum + item.acertos, 0);
  const historical = resultQuestions ? round(correct / resultQuestions * 100) : 0;
  const recent4 = recentQuestions ? round(recentCorrect / recentQuestions * 100) : historical;
  const evolution = {
    meta: meta(date),
    actual: results.map(item => ({ pe: item.pe, date: item.date, accuracy: item.accuracy, block: item.block || item.typ || 'Não classificado' })),
    weekly,
    blocks,
    simulations: simulations(sortedControls),
    summary: { historical, recent4, trend: round(recent4 - historical, 2), resultDays: results.length }
  };
  const risks = {
    meta: meta(date),
    summary: { total: errors.length, recurrent, high, critical, portShare },
    subjects: subjectsPublic.map(item => ({ subject: item.subject, errors: item.errors, recurrent: item.recurrent, high_critical: item.high_critical })),
    recent: [...errors].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.last_edited_time).localeCompare(String(a.last_edited_time))).slice(0, 20).map(item => ({ origin: item.origin, title: item.title, subject: item.subject, severity: item.severity, url: item.url })),
    quality,
    alerts
  };
  const plannedQuestionsMidpoint = future.reduce((sum, item) => sum + (Number(item.planned_questions) || 0), 0);
  const agenda = {
    meta: meta(date),
    current,
    next: future.slice(0, 14),
    allFuture: future,
    recentCompleted: [...actual].filter(item => done(item.status)).sort(byDate).slice(-7).map(item => ({ pe: item.pe, date: item.date, title: item.title, meta: item.meta, acertos: item.acertos, accuracy: item.accuracy })),
    summary: { remainingPE: remaining, operationalDays: days, pace: round(remaining / days, 2), plannedQuestionsMidpoint }
  };
  const redactionsPublic = {
    meta: meta(date),
    summary: { valid: sortedRedactions.length, corrected, notStarted, perWeek, weeksRemaining: weeks },
    redactions: sortedRedactions.map(item => ({ rd: item.rd, week: item.week, pe: item.pe, date: item.date, theme: item.theme, status: item.status, url: item.url, score: item.score })),
    notice: 'Dados lidos diretamente do banco oficial do Notion. Campos ausentes permanecem ausentes e são informados na auditoria.'
  };
  const subjects = { meta: meta(date), subjects: subjectsPublic };
  const auditSummary = {
    completed: completedControls.length,
    current: current?.pe || '',
    result_days: results.length,
    missing_result_days: pendingResults,
    rest_days: actual.filter(item => /descanso/i.test(`${item.title} ${item.block} ${item.typ}`)).length,
    meta_completed: completedQuestions,
    meta_with_result: resultQuestions,
    correct,
    accuracy_result_days: historical,
    conservative_index: completedQuestions ? round(correct / completedQuestions * 100) : 0,
    linked_error_records: errors.filter(item => item.origin).length,
    error_bank_total: errors.length,
    error_bank_recurrent: recurrent,
    error_bank_high: high,
    error_bank_critical: critical,
    redactions_valid: sortedRedactions.length,
    redactions_corrected: corrected,
    redactions_not_started: notStarted
  };
  const downloads = [
    { key: 'execucao', name: `Execução ${actual[0]?.pe || ''}–${actual.at(-1)?.pe || ''}`, filename: 'execucao_TDAS.csv', type: 'CSV' },
    { key: 'planejamento', name: 'Planejamento futuro', filename: 'planejamento_TDAS.csv', type: 'CSV' },
    { key: 'redacoes', name: 'Redações válidas', filename: 'redacoes_TDAS.csv', type: 'CSV' },
    { key: 'erros', name: 'Erros por matéria', filename: 'erros_por_materia.csv', type: 'CSV' },
    { key: 'qualidade', name: 'Qualidade dos dados', filename: 'qualidade_dos_dados.csv', type: 'CSV' },
    { key: 'snapshot', name: 'Snapshot integral', filename: 'snapshot_operacional.json', type: 'JSON' }
  ];
  const audit = { meta: meta(date), summary: auditSummary, quality, sources: sourceList(), downloads };
  const more = { meta: meta(date), links: [
    { title: 'Agenda e planejamento', desc: 'Próximos PE, cronograma e ritmo necessário.', href: '/sedes-tdas-dashboard/agenda/', icon: 'calendar' },
    { title: 'Redações', desc: 'Banco discursivo, temas e ritmo semanal.', href: '/sedes-tdas-dashboard/redacoes/', icon: 'edit' },
    { title: 'Questões erradas', desc: 'Questões, resumos completos e filtros por matéria.', href: '/sedes-tdas-dashboard/questoes-erros/', icon: 'alert' },
    { title: 'Auditoria e downloads', desc: 'Qualidade dos dados, arquivos e fontes do Notion.', href: '/sedes-tdas-dashboard/auditoria/', icon: 'shield' }
  ] };
  const errorRecords = [...errors].sort((a, b) => a.subject.localeCompare(b.subject) || String(b.date).localeCompare(String(a.date)) || a.questionError.localeCompare(b.questionError)).map(publicError);
  const errorParts = [];
  for (let index = 0; index < errorRecords.length; index += 20) errorParts.push(errorRecords.slice(index, index + 20));
  const errorIndex = {
    meta: meta(date),
    total: errorRecords.length,
    materias: subjectsPublic.length,
    reincidentes: recurrent,
    altosCriticos: high + critical,
    parts: errorParts.map((records, index) => ({ file: `part-${String(index + 1).padStart(2, '0')}.json`, count: records.length })),
    subjects: subjectsPublic.map(item => ({ subject: item.subject, count: item.errors }))
  };
  const [actual1, actual2, actual3] = split(actual, 3);
  const [future1, future2] = split(future, 2);
  const [redactions1, redactions2] = split(redactionsPublic.redactions, 2);
  const exportSummary = {
    meta: { ...meta(date), snapshot_date: date, exam_date: EXAM_DATE, timezone: 'America/Sao_Paulo', actual_records: actual.length, completed_records: completedControls.length, future_records: future.length },
    summary: auditSummary,
    current,
    weekly,
    blocks,
    simulations: evolution.simulations,
    links: more.links
  };
  const state = {
    apiVersion: API_VERSION,
    schemaVersion: '20.3',
    snapshotDate: date,
    syncedAt,
    semanticHash: '',
    counts: { controls: controls.length, errors: errors.length, redactions: redactions.length },
    urls: {
      controls: controls.map(item => item.url).sort(),
      errors: errors.map(item => item.url).sort(),
      redactions: redactions.map(item => item.url).sort()
    }
  };
  return {
    home, today, evolution, risks, agenda, redactionsPublic, audit, more, subjects,
    live: {}, state, quality,
    exports: { actual1, actual2, actual3, future1, future2, redactions1, redactions2, errors: risks.subjects, quality, summary: exportSummary },
    errorQuestions: { index: errorIndex, parts: errorParts },
    routes: { peNumbers: sortedControls.map(item => codeNumber(item.pe)), subjectSlugs: subjectsPublic.map(item => item.slug) }
  };
}
