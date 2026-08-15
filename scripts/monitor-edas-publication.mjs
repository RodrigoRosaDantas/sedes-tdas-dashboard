import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TIME_ZONE = 'America/Sao_Paulo';
const REPORT_PATH = process.env.EDAS_MONITOR_REPORT_PATH || '/tmp/edas-publication-monitor.json';
const DEFAULT_MAX_AGE_MINUTES = 420;

const readText = file => fs.readFile(path.join(ROOT, file), 'utf8');
const readJson = async file => JSON.parse(await readText(file));
const validIso = value => !Number.isNaN(Date.parse(String(value || '')));
const sprintCode = value => String(value || '').toUpperCase().match(/^S\d{2}$/)?.[0] || '';
const issue = (code, message, detail = '') => ({ code, message, detail });
const warning = (code, message, detail = '') => ({ code, message, detail });

function formatLocal(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'não informada';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date).replace(',', ' às');
}

function localDate(value) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
}

function latestValidEvent(history) {
  return (history?.events || [])
    .filter(item => ['success', 'no_changes'].includes(item?.status) && validIso(item?.at))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0] || null;
}

function latestPreservationWarning(history) {
  return (history?.events || [])
    .filter(item => item?.status === 'warning' && /quest(ões|oes).*(sem acesso|indispon)|cat[aá]logo.*preserv/i.test(`${item?.title || ''} ${item?.detail || ''}`))
    .sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0))[0] || null;
}

const catalogLeaksAnswers = catalog => (catalog?.questions || []).some(q =>
  Object.prototype.hasOwnProperty.call(q, 'gabarito') ||
  Object.prototype.hasOwnProperty.call(q, 'justificativa'));

const answerKeyInPrecache = sw => {
  const start = sw.indexOf('const CORE=[');
  const end = sw.indexOf('];', start);
  return start >= 0 && end > start && sw.slice(start, end).includes('answer-key.json');
};

function revalidationIssues(site, revalidation) {
  const issues = [];
  if (!revalidation || !['success', 'no_changes'].includes(revalidation.status)) {
    issues.push(issue('REVALIDATION_INVALID', 'A revalidação atual do EDAS está ausente ou inválida.'));
    return issues;
  }
  if (!validIso(revalidation.validatedAt)) issues.push(issue('REVALIDATION_AT_INVALID', 'A revalidação não possui validatedAt válido.'));
  if (revalidation.dataVersion !== site?.meta?.version) issues.push(issue('REVALIDATION_DATA_VERSION_DIVERGENCE', 'A revalidação não corresponde à versão semântica do snapshot.', `snapshot=${site?.meta?.version || 'ausente'}; revalidação=${revalidation.dataVersion || 'ausente'}`));
  if (revalidation.snapshotDate !== site?.meta?.snapshotDate) issues.push(issue('REVALIDATION_SNAPSHOT_DIVERGENCE', 'A revalidação não aponta para o snapshot semântico publicado.', `snapshot=${site?.meta?.snapshotDate || 'ausente'}; revalidação=${revalidation.snapshotDate || 'ausente'}`));
  if (revalidation.sprintId !== site?.today?.sprint) issues.push(issue('REVALIDATION_SPRINT_DIVERGENCE', 'A revalidação e o snapshot apontam para Sprints diferentes.'));
  const observed = revalidation.observed || {};
  const comparisons = [
    ['totalSprints', Number(site?.plan?.totalSprints), 'REVALIDATION_TOTAL_SPRINTS_DIVERGENCE'],
    ['completedSprints', Number(site?.metrics?.completed), 'REVALIDATION_COMPLETED_DIVERGENCE'],
    ['questions', Number(site?.metrics?.questions), 'REVALIDATION_QUESTIONS_DIVERGENCE'],
    ['correct', Number(site?.metrics?.correct), 'REVALIDATION_CORRECT_DIVERGENCE'],
    ['errorsAccumulated', Number(site?.metrics?.errors), 'REVALIDATION_ERRORS_DIVERGENCE'],
    ['errorPages', Number(site?.errorCoverage?.loaded), 'REVALIDATION_ERROR_PAGES_DIVERGENCE'],
    ['cases', Number(site?.metrics?.casesTotal), 'REVALIDATION_CASES_DIVERGENCE'],
  ];
  for (const [key, expected, code] of comparisons) {
    if (Number(observed[key]) !== expected) issues.push(issue(code, `A revalidação diverge do snapshot em ${key}.`, `snapshot=${expected}; revalidação=${observed[key] ?? 'ausente'}`));
  }
  if (Math.abs(Number(observed.accuracy) - Number(site?.metrics?.accuracy)) > 0.005) issues.push(issue('REVALIDATION_ACCURACY_DIVERGENCE', 'A revalidação diverge da acurácia publicada.', `snapshot=${site?.metrics?.accuracy}; revalidação=${observed.accuracy ?? 'ausente'}`));
  return issues;
}

export function evaluateEdas({ site, history, catalog, answerKey, platform, commonJs, sw, player, revalidation = null, now = new Date(), requireFreshness = false, maxAgeMinutes = DEFAULT_MAX_AGE_MINUTES }) {
  const issues = [];
  const warnings = [];
  const dataVersion = String(site?.meta?.version || '');
  const platformVersion = String(platform?.platformVersion || '');
  const sprint = sprintCode(site?.today?.sprint);
  const catalogSprint = sprintCode(catalog?.sprintId);
  const planned = Number(site?.today?.planned);
  const questions = Array.isArray(catalog?.questions) ? catalog.questions : [];
  const answers = answerKey?.answers && typeof answerKey.answers === 'object' ? answerKey.answers : {};
  const commonRelease = commonJs.match(/export const RELEASE='([^']+)'/)?.[1] || '';
  const swVersion = sw.match(/const VERSION='edas-([^']+)'/)?.[1] || '';
  const latestHistory = latestValidEvent(history);
  const preserved = latestPreservationWarning(history);

  if (!dataVersion) issues.push(issue('DATA_VERSION_MISSING', 'O snapshot EDAS não informa versão.'));
  if (!platformVersion) issues.push(issue('PLATFORM_VERSION_MISSING', 'O manifesto técnico não informa versão.'));
  if (history?.release !== dataVersion) issues.push(issue('HISTORY_DATA_VERSION_DIVERGENCE', 'Histórico e snapshot usam versões de dados diferentes.', `site=${dataVersion}; histórico=${history?.release || 'ausente'}`));
  if (platform?.dataVersion !== dataVersion) issues.push(issue('PLATFORM_DATA_VERSION_DIVERGENCE', 'Manifesto técnico não aponta para a versão atual dos dados.', `site=${dataVersion}; manifesto=${platform?.dataVersion || 'ausente'}`));
  if (commonRelease !== platformVersion) issues.push(issue('COMMON_VERSION_DIVERGENCE', 'common.js não usa a versão técnica do manifesto.', `manifesto=${platformVersion}; common=${commonRelease || 'ausente'}`));
  if (swVersion !== platformVersion) issues.push(issue('SW_VERSION_DIVERGENCE', 'Service worker não usa a versão técnica do manifesto.', `manifesto=${platformVersion}; sw=${swVersion || 'ausente'}`));
  if (platform?.serviceWorkerVersion !== `edas-${platformVersion}`) issues.push(issue('SW_MANIFEST_DIVERGENCE', 'Manifesto e service worker não compartilham a mesma versão.'));
  if (!validIso(platform?.syncAt)) issues.push(issue('SYNC_AT_INVALID', 'Manifesto técnico não possui syncAt válido.'));
  if (platform?.sprintId !== sprint) issues.push(issue('PLATFORM_SPRINT_DIVERGENCE', 'Manifesto técnico e snapshot apontam para Sprints diferentes.'));
  if (platform?.catalogVersion !== catalog?.catalogId) issues.push(issue('PLATFORM_CATALOG_DIVERGENCE', 'Manifesto técnico e catálogo divergem.'));

  if (!sprint) issues.push(issue('SPRINT_INVALID', 'O Sprint atual do EDAS é inválido.', String(site?.today?.sprint || 'ausente')));
  if (Number(site?.plan?.totalSprints) !== 42) issues.push(issue('SPRINT_TOTAL_INVALID', 'O planejamento EDAS deve preservar 42 Sprints.', String(site?.plan?.totalSprints)));
  if (!catalog?.catalogId || !catalogSprint || questions.length === 0) issues.push(issue('CATALOG_INVALID', 'O catálogo oficial está ausente ou incompleto.'));

  const preservedCatalog = catalogSprint && sprint && catalogSprint !== sprint && preserved;
  if (catalogSprint && sprint && catalogSprint !== sprint) {
    if (preservedCatalog) warnings.push(warning('CATALOG_PRESERVED', 'O catálogo anterior foi preservado por indisponibilidade documentada da fonte.', `Sprint atual=${sprint}; catálogo=${catalogSprint}`));
    else issues.push(issue('CATALOG_SPRINT_DIVERGENCE', 'O catálogo não corresponde ao Sprint atual.', `Sprint atual=${sprint}; catálogo=${catalogSprint}`));
  }
  if (Number.isFinite(planned) && planned > 0 && catalogSprint === sprint && questions.length !== planned) issues.push(issue('QUESTION_COUNT_DIVERGENCE', 'A bateria publicada diverge da meta objetiva do Sprint.', `planejado=${planned}; catálogo=${questions.length}`));
  if (catalogLeaksAnswers(catalog)) issues.push(issue('CATALOG_ANSWER_LEAK', 'O catálogo público contém gabarito ou justificativa.'));
  if (answerKey?.catalogId !== catalog?.catalogId) issues.push(issue('ANSWER_KEY_CATALOG_DIVERGENCE', 'A ficha de correção não corresponde ao catálogo atual.'));
  if (Object.keys(answers).length !== questions.length) issues.push(issue('ANSWER_KEY_COUNT_DIVERGENCE', 'A ficha de correção não possui uma resposta para cada questão.'));
  const ids = new Set(questions.map(q => q.id));
  if (Object.keys(answers).some(id => !ids.has(id))) issues.push(issue('ANSWER_KEY_EXTRA_ID', 'A ficha de correção contém ID inexistente no catálogo.'));
  if (questions.some(q => !answers[q.id]?.gabarito)) issues.push(issue('ANSWER_KEY_MISSING_ID', 'Há questão sem gabarito correspondente na ficha reservada.'));

  if (answerKeyInPrecache(sw)) issues.push(issue('ANSWER_KEY_PRECACHE', 'O gabarito reservado está no bloco CORE do precache.'));
  if (!sw.includes("url.pathname.startsWith(BASE+'data/')")) issues.push(issue('DATA_NETWORK_FIRST_MISSING', 'O service worker não mantém network-first para dados.'));
  if (!sw.includes("url.pathname.startsWith(BASE+'assets/')")) issues.push(issue('ASSET_NETWORK_FIRST_MISSING', 'O service worker não atualiza assets por network-first.'));
  if (!sw.includes('RESERVED_DATA')) issues.push(issue('RESERVED_DATA_GUARD_MISSING', 'O service worker não remove cópias antigas do gabarito.'));
  if (!sw.includes("USER_CACHE_PREFIX='edas-sec-user-'")) issues.push(issue('SEC_USER_CACHE_GUARD_MISSING', 'O cache pessoal dos SECs não está protegido.'));
  if (!sw.includes('data/platform-version.json')) issues.push(issue('PLATFORM_MANIFEST_PRECACHE_MISSING', 'O manifesto técnico não integra o shell offline.'));

  const finishIndex = player.indexOf('async function finishSession');
  const loadKeyIndex = player.indexOf('loadAnswerKey()', finishIndex);
  const fetchKeyIndex = player.indexOf('data/integration/answer-key.json');
  if (fetchKeyIndex < 0) issues.push(issue('PLAYER_KEY_FETCH_MISSING', 'O player não contém a carga explícita da ficha de correção.'));
  if (finishIndex < 0 || loadKeyIndex < finishIndex) issues.push(issue('PLAYER_KEY_GATE_INVALID', 'A ficha de correção não está condicionada à finalização.'));
  if (!player.includes('matchingSessionDraft')) issues.push(issue('SESSION_RESUME_MISSING', 'O player não possui retomada de sessão.'));
  if (!player.includes('data-review-outcome')) issues.push(issue('ADAPTIVE_REVIEW_MISSING', 'O player não possui decisão pedagógica adaptativa.'));

  let latestValidationAt = latestHistory?.at || null;
  if (revalidation) {
    issues.push(...revalidationIssues(site, revalidation));
    if (validIso(revalidation.validatedAt)) latestValidationAt = revalidation.validatedAt;
  }

  if (requireFreshness) {
    if (revalidation) {
      if (validIso(revalidation.validatedAt)) {
        const age = Math.floor((new Date(now).getTime() - Date.parse(revalidation.validatedAt)) / 60000);
        if (age < -10) issues.push(issue('REVALIDATION_FUTURE', 'A revalidação atual do EDAS está registrada no futuro.', revalidation.validatedAt));
        if (age > maxAgeMinutes) issues.push(issue('REVALIDATION_STALE', `O EDAS está há ${age} minutos sem revalidação oficial válida.`, `Limite=${maxAgeMinutes}; última=${formatLocal(revalidation.validatedAt)}`));
      }
    } else {
      const nowDate = localDate(now);
      if (String(site?.meta?.snapshotDate || '') !== nowDate) issues.push(issue('SNAPSHOT_STALE', 'O snapshot EDAS não corresponde à data atual e não há revalidação semântica separada.', `snapshot=${site?.meta?.snapshotDate || 'ausente'}; esperado=${nowDate}`));
      if (!latestHistory) issues.push(issue('HISTORY_VALID_EVENT_MISSING', 'O histórico EDAS não possui revalidação válida.'));
      else {
        const age = Math.floor((new Date(now).getTime() - Date.parse(latestHistory.at)) / 60000);
        if (age < -10) issues.push(issue('HISTORY_EVENT_FUTURE', 'A última revalidação EDAS está registrada no futuro.', latestHistory.at));
        if (age > maxAgeMinutes) issues.push(issue('HISTORY_STALE', `O EDAS está há ${age} minutos sem revalidação técnica válida.`, `Limite=${maxAgeMinutes}; última=${formatLocal(latestHistory.at)}`));
      }
    }
  }

  const healthy = issues.length === 0;
  return {
    healthy,
    status: healthy ? (warnings.length ? 'degraded' : 'healthy') : 'blocked',
    checkedAt: new Date(now).toISOString(),
    checkedAtLocal: formatLocal(now),
    version: platformVersion,
    dataVersion,
    sprint,
    catalogSprint,
    planned: Number.isFinite(planned) ? planned : null,
    questionCount: questions.length,
    latestValidationAt,
    latestValidationAtLocal: formatLocal(latestValidationAt),
    validationMode: revalidation ? 'semantic-revalidation' : 'legacy-snapshot',
    issues,
    warnings,
    summary: healthy
      ? `${sprint || 'EDAS'}: plataforma ${platformVersion} íntegra sobre dados ${dataVersion}${warnings.length ? ' com ressalva controlada' : ''}.`
      : `EDAS inconsistente: ${issues.map(x => x.code).join(', ')}.`,
  };
}

function markdown(report) {
  const lines = [
    '## Monitoramento da publicação EDAS', '',
    `- **Estado:** ${report.healthy ? (report.warnings.length ? 'íntegro com ressalva' : 'íntegro') : 'inconsistente'}`,
    `- **Sprint atual:** ${report.sprint || 'não identificado'}`,
    `- **Plataforma:** ${report.version || 'não identificada'}`,
    `- **Dados:** ${report.dataVersion || 'não identificados'}`,
    `- **Catálogo:** ${report.catalogSprint || 'não identificado'} · ${report.questionCount} questões`,
    `- **Última revalidação:** ${report.latestValidationAtLocal || 'não informada'}`,
    `- **Modo de frescor:** ${report.validationMode}`,
    `- **Resumo:** ${report.summary}`,
  ];
  if (report.warnings.length) {
    lines.push('', '### Ressalvas');
    for (const x of report.warnings) lines.push(`- **${x.code}:** ${x.message}${x.detail ? ` — ${x.detail}` : ''}`);
  }
  if (report.issues.length) {
    lines.push('', '### Inconsistências');
    for (const x of report.issues) lines.push(`- **${x.code}:** ${x.message}${x.detail ? ` — ${x.detail}` : ''}`);
  }
  return lines.join('\n');
}

async function loadCurrent() {
  const [site, history, catalog, answerKey, platform, commonJs, sw, player, revalidation] = await Promise.all([
    readJson('edas-administracao/data/site.json'),
    readJson('edas-administracao/data/sync-history.json'),
    readJson('edas-administracao/data/integration/question-catalog.json'),
    readJson('edas-administracao/data/integration/answer-key.json'),
    readJson('edas-administracao/data/platform-version.json'),
    readText('edas-administracao/assets/common.js'),
    readText('edas-administracao/sw.js'),
    readText('edas-administracao/assets/integration/module-player.js'),
    readJson('edas-administracao/data/revalidation.json'),
  ]);
  return { site, history, catalog, answerKey, platform, commonJs, sw, player, revalidation };
}

if (process.env.MONITOR_SELF_TEST === 'true') {
  const fixture = {
    site: {
      meta: { version: 'data1', snapshotDate: '2026-08-06' },
      plan: { totalSprints: 42 },
      metrics: { completed: 6, questions: 205, correct: 167, accuracy: 81.46, errors: 38, casesTotal: 12 },
      errorCoverage: { loaded: 31 },
      today: { sprint: 'S12', planned: 2 },
    },
    history: { release: 'data1', events: [{ at: '2026-08-06T16:00:00-03:00', status: 'no_changes' }] },
    catalog: { catalogId: 'c1', sprintId: 'S12', questions: [{ id: 'q1' }, { id: 'q2' }] },
    answerKey: { catalogId: 'c1', answers: { q1: { gabarito: 'A' }, q2: { gabarito: 'B' } } },
    platform: { platformVersion: 'tech2', dataVersion: 'data1', catalogVersion: 'c1', serviceWorkerVersion: 'edas-tech2', syncAt: '2026-08-07T16:00:00-03:00', sprintId: 'S12' },
    commonJs: "export const RELEASE='tech2';",
    sw: "const VERSION='edas-tech2'; const USER_CACHE_PREFIX='edas-sec-user-'; const RESERVED_DATA=[]; const CORE=['data/platform-version.json']; if(url.pathname.startsWith(BASE+'data/')){} if(url.pathname.startsWith(BASE+'assets/')){}",
    player: "async function loadAnswerKey(){fetch(BASE+'data/integration/answer-key.json')} async function finishSession(){await loadAnswerKey()} matchingSessionDraft(); data-review-outcome",
    revalidation: {
      status: 'no_changes', validatedAt: '2026-08-07T16:00:00-03:00', snapshotDate: '2026-08-06', dataVersion: 'data1', sprintId: 'S12',
      observed: { totalSprints: 42, completedSprints: 6, questions: 205, correct: 167, accuracy: 81.46, errorsAccumulated: 38, errorPages: 31, cases: 12 },
    },
  };
  const ok = evaluateEdas({ ...fixture, now: new Date('2026-08-07T16:30:00-03:00'), requireFreshness: true });
  assert.equal(ok.healthy, true);
  assert.equal(ok.validationMode, 'semantic-revalidation');
  const mismatch = evaluateEdas({ ...fixture, revalidation: { ...fixture.revalidation, observed: { ...fixture.revalidation.observed, questions: 204 } }, now: new Date('2026-08-07T16:30:00-03:00'), requireFreshness: true });
  assert.equal(mismatch.healthy, false);
  assert.ok(mismatch.issues.some(item => item.code === 'REVALIDATION_QUESTIONS_DIVERGENCE'));
  const leak = evaluateEdas({ ...fixture, catalog: { ...fixture.catalog, questions: [{ id: 'q1', gabarito: 'A' }, { id: 'q2' }] } });
  assert.equal(leak.healthy, false);
  console.log('Monitor EDAS auditado: manifesto, dados, revalidação semântica, retomada, revisão adaptativa, PWA e frescor cobertos.');
} else {
  const current = await loadCurrent();
  const report = evaluateEdas({
    ...current,
    requireFreshness: process.env.REQUIRE_EDAS_FRESHNESS === 'true',
    maxAgeMinutes: Number(process.env.EDAS_MAX_AGE_MINUTES || DEFAULT_MAX_AGE_MINUTES),
  });
  report.markdown = markdown(report);
  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(report.markdown);
  if (!report.healthy) process.exitCode = 1;
}
