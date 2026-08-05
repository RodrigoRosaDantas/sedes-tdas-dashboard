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

export function evaluatePublication({
  now = new Date(),
  platform,
  today,
  catalog,
  material,
  contract,
  history,
  maxAgeMinutes = DEFAULT_MAX_AGE_MINUTES
}) {
  const currentDate = localDate(now);
  const examDate = String(today?.meta?.examDate || '2026-09-06');
  const cycleStart = '2026-07-03';

  if (currentDate < cycleStart || currentDate > examDate) {
    return {
      status: 'skipped',
      healthy: true,
      currentDate,
      examDate,
      summary: `Monitoramento dispensado fora da janela operacional ${cycleStart}–${examDate}.`,
      issues: []
    };
  }

  const issues = [];
  const syncAt = platform?.syncAt;
  const syncTimestamp = Date.parse(String(syncAt || ''));
  const latestValid = (history?.entries || []).find(entry => VALID_SYNC_STATUSES.has(entry?.status) && validIso(entry?.at));

  if (!validIso(syncAt)) {
    issues.push(issue('SYNC_AT_INVALID', 'O manifesto não possui data/hora válida da última sincronização.', String(syncAt || 'ausente')));
  } else {
    const ageMinutes = Math.floor((new Date(now).getTime() - syncTimestamp) / 60000);
    if (ageMinutes < -10) {
      issues.push(issue('SYNC_AT_FUTURE', 'A última sincronização está registrada no futuro.', `${formatLocal(syncAt)}; agora ${formatLocal(now)}`));
    } else if (ageMinutes > maxAgeMinutes) {
      issues.push(issue('SYNC_STALE', `A publicação está há ${ageMinutes} minutos sem sincronização válida.`, `Limite operacional: ${maxAgeMinutes} minutos; última: ${formatLocal(syncAt)}`));
    }
  }

  if (!latestValid) {
    issues.push(issue('HISTORY_MISSING', 'O histórico não contém execução válida de sincronização.', 'Esperado status success ou no_changes.'));
  } else if (validIso(syncAt) && new Date(latestValid.at).getTime() !== syncTimestamp) {
    issues.push(issue('HISTORY_DIVERGENCE', 'O manifesto e o histórico apontam sincronizações diferentes.', `Manifesto: ${syncAt}; histórico: ${latestValid.at}`));
  }

  const snapshotDate = String(today?.meta?.snapshotDate || '');
  const executionDate = String(today?.current?.date || '');
  if (snapshotDate !== currentDate) {
    issues.push(issue('SNAPSHOT_DATE_STALE', 'O snapshot público não corresponde à data atual.', `Snapshot: ${snapshotDate || 'ausente'}; esperado: ${currentDate}`));
  }
  if (executionDate !== currentDate) {
    issues.push(issue('EXECUTION_DATE_STALE', 'O PE publicado não corresponde ao dia atual.', `PE ${today?.current?.pe || 'ausente'} está associado a ${executionDate || 'data ausente'}; esperado: ${currentDate}`));
  }

  const peValues = {
    plataforma: peCode(platform?.peId),
    hoje: peCode(today?.current?.pe),
    catalogo: peCode(catalog?.peId),
    material: peCode(material?.peId),
    contrato: peCode(contract?.current?.peId)
  };
  const peSet = new Set(Object.values(peValues).filter(Boolean));
  if (Object.values(peValues).some(value => !value) || peSet.size !== 1) {
    issues.push(issue('PE_DIVERGENCE', 'PE, material, questões e contrato diário não estão alinhados.', JSON.stringify(peValues)));
  }

  const expectedQuestions = Number(today?.current?.meta ?? 0);
  const questionCount = Number(catalog?.questionCount ?? -1);
  const questionsLength = Array.isArray(catalog?.questions) ? catalog.questions.length : -1;
  if (!Number.isInteger(expectedQuestions) || expectedQuestions < 0) {
    issues.push(issue('QUESTION_TARGET_INVALID', 'A meta oficial de questões é inválida.', String(today?.current?.meta)));
  } else if (questionCount !== expectedQuestions || questionsLength !== expectedQuestions) {
    issues.push(issue('QUESTION_COUNT_DIVERGENCE', 'A quantidade publicada de questões diverge da meta oficial.', `Meta: ${expectedQuestions}; catálogo: ${questionCount}; lista: ${questionsLength}`));
  }

  if (material?.mode !== 'notion-daily-material' || String(material?.html || '').trim().length < 200) {
    issues.push(issue('MATERIAL_INVALID', 'O material diário está ausente ou incompleto.', `Modo: ${material?.mode || 'ausente'}; HTML: ${String(material?.html || '').length} caracteres`));
  }

  if (contract?.current?.materialPageId !== material?.source?.pageId) {
    issues.push(issue('MATERIAL_CONTRACT_DIVERGENCE', 'O contrato diário não aponta para o material publicado.', `Contrato: ${contract?.current?.materialPageId || 'ausente'}; material: ${material?.source?.pageId || 'ausente'}`));
  }

  const healthy = issues.length === 0;
  return {
    status: healthy ? 'healthy' : 'blocked',
    healthy,
    checkedAt: new Date(now).toISOString(),
    checkedAtLocal: formatLocal(now),
    currentDate,
    examDate,
    maxAgeMinutes,
    syncAt: validIso(syncAt) ? new Date(syncAt).toISOString() : null,
    syncAtLocal: formatLocal(syncAt),
    pe: peValues.hoje || peValues.plataforma || '',
    expectedQuestions,
    questionCount,
    summary: healthy
      ? `${peValues.hoje}: publicação diária íntegra, atual e alinhada entre snapshot, material, questões e contrato.`
      : `${issues.length} inconsistência(s) bloqueiam a confirmação da publicação diária TDAS.`,
    issues
  };
}

function markdownReport(report) {
  const lines = [
    `## Monitoramento da publicação diária TDAS`,
    '',
    `- **Estado:** ${report.healthy ? 'recuperado/íntegro' : 'atenção necessária'}`,
    `- **Verificação:** ${report.checkedAtLocal || report.currentDate}`,
    `- **Última sincronização válida:** ${report.syncAtLocal || 'não informada'}`,
    `- **PE observado:** ${report.pe || 'não identificado'}`,
    `- **Resumo:** ${report.summary}`
  ];
  if (report.issues?.length) {
    lines.push('', '### Inconsistências');
    for (const item of report.issues) lines.push(`- **${item.code}:** ${item.message}${item.detail ? ` — ${item.detail}` : ''}`);
  }
  lines.push('', 'Este alerta é mantido automaticamente. Ele será fechado quando uma verificação posterior confirmar a recuperação integral.');
  return lines.join('\n');
}

async function runSelfTest() {
  const now = new Date('2026-08-05T15:20:00-03:00');
  const syncAt = '2026-08-05T14:50:00-03:00';
  const base = {
    now,
    platform: { syncAt, peId: 'PE80' },
    today: { meta: { snapshotDate: '2026-08-05', examDate: '2026-09-06' }, current: { date: '2026-08-05', pe: 'PE80', meta: 35 } },
    catalog: { peId: 'PE80', questionCount: 35, questions: Array.from({ length: 35 }, (_, index) => ({ id: `q${index + 1}` })) },
    material: { mode: 'notion-daily-material', peId: 'PE80', html: 'x'.repeat(300), source: { pageId: 'material-page' } },
    contract: { current: { peId: 'PE80', materialPageId: 'material-page' } },
    history: { entries: [{ at: syncAt, status: 'success' }] },
    maxAgeMinutes: 180
  };
  const healthy = evaluatePublication(base);
  assert.equal(healthy.status, 'healthy');
  assert.equal(healthy.issues.length, 0);

  const stale = evaluatePublication({ ...base, now: new Date('2026-08-05T19:30:00-03:00') });
  assert.equal(stale.status, 'blocked');
  assert.ok(stale.issues.some(item => item.code === 'SYNC_STALE'));

  const divergent = evaluatePublication({ ...base, catalog: { ...base.catalog, peId: 'PE79' } });
  assert.equal(divergent.status, 'blocked');
  assert.ok(divergent.issues.some(item => item.code === 'PE_DIVERGENCE'));

  console.log('Watchdog TDAS validado: fluxo íntegro, atraso e divergência de PE cobertos.');
}

if (process.env.MONITOR_SELF_TEST === 'true') {
  await runSelfTest();
} else {
  const [platform, today, catalog, material, contract, history] = await Promise.all([
    readJson('data/platform-version.json'),
    readJson('data/today.json'),
    readJson('data/integration/question-catalog.json'),
    readJson('data/integration/daily-material.json'),
    readJson('data/integration/daily-execution.json'),
    readJson('data/sync-history.json')
  ]);
  const now = process.env.MONITOR_NOW ? new Date(process.env.MONITOR_NOW) : new Date();
  const maxAgeMinutes = Number(process.env.MAX_SYNC_AGE_MINUTES || DEFAULT_MAX_AGE_MINUTES);
  const report = evaluatePublication({ now, platform, today, catalog, material, contract, history, maxAgeMinutes });
  report.markdown = markdownReport(report);
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report));
  if (!report.healthy) process.exitCode = 1;
}
