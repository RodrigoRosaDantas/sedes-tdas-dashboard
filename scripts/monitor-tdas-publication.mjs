import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TIME_ZONE = 'America/Sao_Paulo';
const DEFAULT_MAX_AGE_MINUTES = 180;
const REPORT_PATH = process.env.MONITOR_REPORT_PATH || '/tmp/tdas-publication-monitor.json';
const VALID_SYNC_STATUSES = new Set(['success', 'no_changes']);

const readJson = async file => JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf8'));
const peCode = value => String(value || '').toUpperCase().match(/^PE\d{1,3}$/)?.[0] || '';
const validIso = value => !Number.isNaN(Date.parse(String(value || '')));
const integerValue = value => {
  const number = Number(value);
  return Number.isInteger(number) ? number : Number.NaN;
};

function dateParts(value, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

export function localDate(value, timeZone = TIME_ZONE) {
  const parts = dateParts(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatLocal(value, timeZone = TIME_ZONE) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'não informada';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date).replace(',', ' às');
}

function issue(code, message, detail = '') {
  return { code, message, detail };
}

function scheduledDays(agenda) {
  const candidates = [agenda?.current, ...(agenda?.next || []), ...(agenda?.allFuture || [])].filter(Boolean);
  const seen = new Set();
  return candidates.filter(item => {
    const key = `${String(item?.date || '')}|${peCode(item?.pe)}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function latestValidSync(history) {
  return (history?.entries || [])
    .filter(entry => VALID_SYNC_STATUSES.has(entry?.status) && validIso(entry?.at))
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))[0] || null;
}

export function evaluatePublication({
  now = new Date(),
  platform,
  today,
  agenda,
  catalog,
  material,
  contract,
  history,
  maxAgeMinutes = DEFAULT_MAX_AGE_MINUTES
}) {
  const currentDate = localDate(now);
  const examDate = String(today?.meta?.examDate || agenda?.meta?.examDate || '2026-09-06');
  const cycleStart = '2026-07-03';

  if (currentDate < cycleStart || currentDate > examDate) {
    return {
      status: 'skipped',
      healthy: true,
      scope: 'publicação técnica GitHub/site',
      currentDate,
      examDate,
      summary: `Monitoramento dispensado fora da janela operacional ${cycleStart}–${examDate}.`,
      issues: []
    };
  }

  const issues = [];
  const expectedDay = scheduledDays(agenda).find(item => String(item?.date || '') === currentDate) || null;
  const expectedPe = peCode(expectedDay?.pe);
  const expectedTitle = String(expectedDay?.title || '');
  const expectedQuestions = integerValue(expectedDay?.planned_questions ?? expectedDay?.meta ?? today?.current?.meta);

  if (!expectedDay || !expectedPe) {
    issues.push(issue('AGENDA_DAY_MISSING', 'O calendário técnico não identifica o PE esperado para a data atual.', `Data: ${currentDate}`));
  }

  const syncAt = platform?.syncAt;
  const syncTimestamp = Date.parse(String(syncAt || ''));
  const latestValid = latestValidSync(history);

  if (!validIso(syncAt)) {
    issues.push(issue('SYNC_AT_INVALID', 'O manifesto não possui data/hora válida da última sincronização.', String(syncAt || 'ausente')));
  } else {
    const ageMinutes = Math.floor((new Date(now).getTime() - syncTimestamp) / 60000);
    if (ageMinutes < -10) {
      issues.push(issue('SYNC_AT_FUTURE', 'A última sincronização está registrada no futuro.', `${formatLocal(syncAt)}; agora ${formatLocal(now)}`));
    } else if (ageMinutes > maxAgeMinutes) {
      issues.push(issue('SYNC_STALE', `O site está há ${ageMinutes} minutos sem sincronização técnica válida.`, `Limite operacional: ${maxAgeMinutes} minutos; última: ${formatLocal(syncAt)}`));
    }
  }

  if (!latestValid) {
    issues.push(issue('HISTORY_MISSING', 'O histórico não contém execução válida de sincronização.', 'Esperado status success ou no_changes.'));
  } else if (validIso(syncAt) && new Date(latestValid.at).getTime() !== syncTimestamp) {
    issues.push(issue('HISTORY_DIVERGENCE', 'O manifesto e o histórico apontam sincronizações diferentes.', `Manifesto: ${syncAt}; histórico mais recente: ${latestValid.at}`));
  }

  const snapshotDate = String(today?.meta?.snapshotDate || '');
  const publishedExecutionDate = String(today?.current?.date || '');
  if (snapshotDate !== currentDate) {
    issues.push(issue('SNAPSHOT_DATE_STALE', 'O snapshot técnico do site não corresponde à data atual.', `Snapshot publicado: ${snapshotDate || 'ausente'}; esperado: ${currentDate}`));
  }
  if (publishedExecutionDate !== currentDate) {
    issues.push(issue('EXECUTION_DATE_STALE', 'O registro exibido no site não corresponde ao dia atual.', `Registro publicado: ${today?.current?.pe || 'ausente'} em ${publishedExecutionDate || 'data ausente'}; esperado no calendário: ${expectedPe || 'não identificado'} em ${currentDate}`));
  }

  const peValues = {
    plataforma: peCode(platform?.peId),
    hoje: peCode(today?.current?.pe),
    catalogo: peCode(catalog?.peId),
    material: peCode(material?.peId),
    contrato: peCode(contract?.current?.peId)
  };
  const publishedPe = peValues.hoje || peValues.plataforma || peValues.catalogo || peValues.material || peValues.contrato || '';
  const peSet = new Set(Object.values(peValues).filter(Boolean));
  if (Object.values(peValues).some(value => !value) || peSet.size !== 1) {
    issues.push(issue('PE_DIVERGENCE', 'Manifesto, página Hoje, material, questões e contrato diário não estão alinhados entre si.', JSON.stringify(peValues)));
  }
  if (expectedPe && Object.values(peValues).some(value => value && value !== expectedPe)) {
    issues.push(issue('EXPECTED_PE_MISMATCH', 'O site/GitHub ainda não publicou o PE previsto no calendário para hoje.', `Esperado: ${expectedPe}; publicado: ${JSON.stringify(peValues)}`));
  }

  const questionCount = Number(catalog?.questionCount ?? -1);
  const questionsLength = Array.isArray(catalog?.questions) ? catalog.questions.length : -1;
  const deferredAdaptive = catalog?.mode === 'notion-daily-adaptive-pending'
    && catalog?.availability?.state === 'awaiting-prerequisite'
    && peCode(catalog?.peId) === 'PE105'
    && catalog?.availability?.prerequisitePe === 'PE104'
    && catalog?.availability?.prerequisiteRd === 'RD30'
    && Number(catalog?.plannedQuestionCount) === 60
    && questionCount === 0
    && questionsLength === 0;
  const publishedPlanCount = deferredAdaptive ? Number(catalog?.plannedQuestionCount ?? -1) : questionCount;
  if (!Number.isInteger(expectedQuestions) || expectedQuestions < 0) {
    issues.push(issue('QUESTION_TARGET_INVALID', 'A meta de questões do calendário é inválida.', String(expectedDay?.planned_questions ?? expectedDay?.meta ?? today?.current?.meta)));
  } else if (publishedPlanCount !== expectedQuestions || (!deferredAdaptive && questionsLength !== expectedQuestions)) {
    issues.push(issue('QUESTION_COUNT_DIVERGENCE', 'A quantidade publicada de questões diverge da meta do PE esperado.', `PE esperado: ${expectedPe || 'não identificado'}; meta: ${expectedQuestions}; plano: ${publishedPlanCount}; catálogo jogável: ${questionCount}; lista: ${questionsLength}`));
  }

  if (material?.mode !== 'notion-daily-material' || String(material?.html || '').trim().length < 200) {
    issues.push(issue('MATERIAL_INVALID', 'O material diário publicado está ausente ou incompleto.', `Modo: ${material?.mode || 'ausente'}; HTML: ${String(material?.html || '').length} caracteres`));
  }

  if (contract?.current?.materialPageId !== material?.source?.pageId) {
    issues.push(issue('MATERIAL_CONTRACT_DIVERGENCE', 'O contrato diário não aponta para o material publicado.', `Contrato: ${contract?.current?.materialPageId || 'ausente'}; material: ${material?.source?.pageId || 'ausente'}`));
  }

  const healthy = issues.length === 0;
  return {
    status: healthy ? 'healthy' : 'blocked',
    healthy,
    scope: 'publicação técnica GitHub/site',
    checkedAt: new Date(now).toISOString(),
    checkedAtLocal: formatLocal(now),
    currentDate,
    examDate,
    maxAgeMinutes,
    syncAt: validIso(syncAt) ? new Date(syncAt).toISOString() : null,
    syncAtLocal: formatLocal(syncAt),
    expectedPe,
    expectedTitle,
    publishedPe,
    expectedQuestions,
    questionCount,
    plannedQuestionCount: publishedPlanCount,
    questionAvailability: deferredAdaptive ? 'awaiting-prerequisite' : 'available',
    summary: healthy
      ? deferredAdaptive
        ? `${expectedPe}: publicação técnica íntegra; 60 questões adaptativas aguardam a correção oficial do PE104/RD30 e a Matriz Final.`
        : `${expectedPe}: publicação técnica do site íntegra e alinhada entre calendário, snapshot, material, questões e contrato.`
      : `O site/GitHub ainda não confirmou integralmente a publicação técnica de ${expectedPe || 'PE do dia'}; isso não altera nem invalida a execução registrada no Notion.`,
    issues
  };
}

function markdownReport(report) {
  const lines = [
    '## Monitoramento da publicação técnica TDAS',
    '',
    '> Este monitor verifica somente o GitHub e o site público. Ele não mede, desconsidera ou altera a conclusão do estudo registrada no Notion.',
    '',
    `- **Estado do site:** ${report.healthy ? 'atualizado/íntegro' : 'publicação técnica pendente'}`,
    `- **Verificação:** ${report.checkedAtLocal || report.currentDate}`,
    `- **PE esperado pelo calendário:** ${report.expectedPe || 'não identificado'}${report.expectedTitle ? ` — ${report.expectedTitle}` : ''}`,
    `- **PE atualmente publicado no site:** ${report.publishedPe || 'não identificado'}`,
    `- **Última sincronização técnica válida:** ${report.syncAtLocal || 'não informada'}`,
    `- **Resumo:** ${report.summary}`
  ];
  if (report.issues?.length) {
    lines.push('', '### Inconsistências técnicas');
    for (const item of report.issues) lines.push(`- **${item.code}:** ${item.message}${item.detail ? ` — ${item.detail}` : ''}`);
  }
  lines.push('', 'Este incidente é reutilizado pelo watchdog e será fechado quando uma verificação posterior confirmar a recuperação integral do site.');
  return lines.join('\n');
}

async function runSelfTest() {
  const now = new Date('2026-08-05T15:20:00-03:00');
  const syncAt = '2026-08-05T14:50:00-03:00';
  const agenda = {
    meta: { examDate: '2026-09-06' },
    current: { pe: 'PE79', date: '2026-08-04', title: 'Arquivologia', planned_questions: '35' },
    next: [{ pe: 'PE80', date: '2026-08-05', title: 'Materiais e estoque', planned_questions: '35' }],
    allFuture: []
  };
  const base = {
    now,
    platform: { syncAt, peId: 'PE80' },
    today: { meta: { snapshotDate: '2026-08-05', examDate: '2026-09-06' }, current: { date: '2026-08-05', pe: 'PE80', meta: 35 } },
    agenda,
    catalog: { peId: 'PE80', questionCount: 35, questions: Array.from({ length: 35 }, (_, index) => ({ id: `q${index + 1}` })) },
    material: { mode: 'notion-daily-material', peId: 'PE80', html: 'x'.repeat(300), source: { pageId: 'material-page' } },
    contract: { current: { peId: 'PE80', materialPageId: 'material-page' } },
    history: { entries: [{ at: '2026-08-04T23:27:19-03:00', status: 'success' }, { at: syncAt, status: 'success' }] },
    maxAgeMinutes: 180
  };
  const healthy = evaluatePublication(base);
  assert.equal(healthy.status, 'healthy');
  assert.equal(healthy.expectedPe, 'PE80');
  assert.equal(healthy.publishedPe, 'PE80');
  assert.equal(healthy.issues.length, 0);

  const adaptiveAgenda = {
    meta: { examDate: '2026-09-06' },
    current: { pe: 'PE105', date: '2026-08-30', title: 'Autópsia PE104 + Matriz Final', planned_questions: '60' },
    next: [],
    allFuture: []
  };
  const adaptive = evaluatePublication({
    ...base,
    now: new Date('2026-08-30T08:30:00-03:00'),
    platform: { syncAt: '2026-08-30T08:00:00-03:00', peId: 'PE105' },
    today: { meta: { snapshotDate: '2026-08-30', examDate: '2026-09-06' }, current: { date: '2026-08-30', pe: 'PE105', meta: 60 } },
    agenda: adaptiveAgenda,
    catalog: { peId: 'PE105', mode: 'notion-daily-adaptive-pending', questionCount: 0, plannedQuestionCount: 60, availability: { state: 'awaiting-prerequisite', prerequisitePe: 'PE104', prerequisiteRd: 'RD30' }, questions: [] },
    material: { mode: 'notion-daily-material', peId: 'PE105', html: 'x'.repeat(300), source: { pageId: 'material-page-105' } },
    contract: { current: { peId: 'PE105', materialPageId: 'material-page-105' } },
    history: { entries: [{ at: '2026-08-30T08:00:00-03:00', status: 'success' }] }
  });
  assert.equal(adaptive.status, 'healthy','O watchdog deve aceitar a espera explícita pelo pré-requisito quando o plano publicado fecha 60.');
  assert.equal(adaptive.plannedQuestionCount,60);
  assert.equal(adaptive.questionCount,0);
  const adaptiveDivergent=evaluatePublication({
    ...base,
    now:new Date('2026-08-30T08:30:00-03:00'),
    platform:{syncAt:'2026-08-30T08:00:00-03:00',peId:'PE105'},
    today:{meta:{snapshotDate:'2026-08-30',examDate:'2026-09-06'},current:{date:'2026-08-30',pe:'PE105',meta:60}},
    agenda:adaptiveAgenda,
    catalog:{peId:'PE105',mode:'notion-daily-adaptive-pending',questionCount:0,plannedQuestionCount:40,availability:{state:'awaiting-prerequisite',prerequisitePe:'PE104',prerequisiteRd:'RD30'},questions:[]},
    material:{mode:'notion-daily-material',peId:'PE105',html:'x'.repeat(300),source:{pageId:'material-page-105'}},
    contract:{current:{peId:'PE105',materialPageId:'material-page-105'}},
    history:{entries:[{at:'2026-08-30T08:00:00-03:00',status:'success'}]}
  });
  assert.ok(adaptiveDivergent.issues.some(item=>item.code==='QUESTION_COUNT_DIVERGENCE'),'Plano adaptativo 40/60 deve continuar bloqueado.');

  const stale = evaluatePublication({ ...base, now: new Date('2026-08-05T19:30:00-03:00') });
  assert.equal(stale.status, 'blocked');
  assert.ok(stale.issues.some(item => item.code === 'SYNC_STALE'));

  const previousSync = '2026-08-04T23:27:19-03:00';
  const outdated = evaluatePublication({
    ...base,
    now: new Date('2026-08-05T18:30:00-03:00'),
    platform: { syncAt: previousSync, peId: 'PE79' },
    today: { meta: { snapshotDate: '2026-08-04', examDate: '2026-09-06' }, current: { date: '2026-08-04', pe: 'PE79', meta: 35 } },
    catalog: { peId: 'PE79', questionCount: 35, questions: Array.from({ length: 35 }, (_, index) => ({ id: `q${index + 1}` })) },
    material: { mode: 'notion-daily-material', peId: 'PE79', html: 'x'.repeat(300), source: { pageId: 'material-page-79' } },
    contract: { current: { peId: 'PE79', materialPageId: 'material-page-79' } },
    history: { entries: [{ at: previousSync, status: 'success' }] }
  });
  assert.equal(outdated.status, 'blocked');
  assert.equal(outdated.expectedPe, 'PE80');
  assert.equal(outdated.publishedPe, 'PE79');
  assert.ok(outdated.issues.some(item => item.code === 'EXPECTED_PE_MISMATCH'));

  console.log('Watchdog TDAS auditado: calendário independente, histórico ordenado, atraso e publicação de PE incorreto cobertos.');
}

if (process.env.MONITOR_SELF_TEST === 'true') {
  await runSelfTest();
} else {
  const [platform, today, agenda, catalog, material, contract, history] = await Promise.all([
    readJson('data/platform-version.json'),
    readJson('data/today.json'),
    readJson('data/agenda.json'),
    readJson('data/integration/question-catalog.json'),
    readJson('data/integration/daily-material.json'),
    readJson('data/integration/daily-execution.json'),
    readJson('data/sync-history.json')
  ]);
  const now = process.env.MONITOR_NOW ? new Date(process.env.MONITOR_NOW) : new Date();
  const maxAgeMinutes = Number(process.env.MAX_SYNC_AGE_MINUTES || DEFAULT_MAX_AGE_MINUTES);
  const report = evaluatePublication({ now, platform, today, agenda, catalog, material, contract, history, maxAgeMinutes });
  report.markdown = markdownReport(report);
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report));
  if (!report.healthy) process.exitCode = 1;
}
