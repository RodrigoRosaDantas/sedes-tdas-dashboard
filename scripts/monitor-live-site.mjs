import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchWithTimeout, normalizeTimeoutMs } from './http-monitor.mjs';

const ROOT = process.cwd();
const DEFAULT_BASE_URL = 'https://rodrigorosadantas.github.io/sedes-tdas-dashboard';
const REPORT_PATH = process.env.LIVE_SITE_REPORT_PATH || '/tmp/tdas-live-site-monitor.json';
const DEFAULT_ATTEMPTS = 12;
const DEFAULT_DELAY_MS = 15000;
const REQUEST_TIMEOUT_MS = normalizeTimeoutMs(process.env.LIVE_SITE_REQUEST_TIMEOUT_MS, 8000);

const readJson = async file => JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf8'));
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const normalizeBase = value => String(value || DEFAULT_BASE_URL).replace(/\/+$/, '');
const issue = (code, message, detail = '') => ({ code, message, detail });

function comparableSummary(summary = {}) {
  return {
    total: Number(summary.total),
    corrected: Number(summary.corrected),
    pending: Number(summary.pending),
    average: Number(summary.average),
    readiness: Number(summary.readiness),
    scheduleAdherence: Number(summary.scheduleAdherence),
    rewriteCompletion: Number(summary.rewriteCompletion)
  };
}

export function evaluateLiveSite({
  expectedPlatform,
  expectedRedactions,
  livePlatform,
  liveRedactions,
  homeHtml,
  commonJs,
  redactionsHtml,
  lockedRd = '',
  lockedDetail = null
}) {
  const issues = [];

  if (livePlatform?.publicationId !== expectedPlatform?.publicationId) {
    issues.push(issue(
      'DEPLOY_PUBLICATION_MISMATCH',
      'O GitHub Pages ainda não serve a publicação registrada na main.',
      `Main: ${expectedPlatform?.publicationId || 'ausente'}; site: ${livePlatform?.publicationId || 'ausente'}`
    ));
  }

  for (const key of ['platformVersion', 'dataVersion', 'catalogVersion', 'serviceWorkerVersion', 'syncAt', 'peId']) {
    if (livePlatform?.[key] !== expectedPlatform?.[key]) {
      issues.push(issue('DEPLOY_MANIFEST_DIVERGENCE', `O campo ${key} diverge entre main e site.`, `Main: ${expectedPlatform?.[key]}; site: ${livePlatform?.[key]}`));
    }
  }

  if (String(liveRedactions?.schemaVersion || '') !== String(expectedRedactions?.schemaVersion || '')) {
    issues.push(issue('REDACTIONS_SCHEMA_MISMATCH', 'O contrato discursivo implantado está em versão diferente da main.', `Main: ${expectedRedactions?.schemaVersion}; site: ${liveRedactions?.schemaVersion}`));
  }

  if (liveRedactions?.meta?.generatedAt !== expectedRedactions?.meta?.generatedAt) {
    issues.push(issue('REDACTIONS_SNAPSHOT_MISMATCH', 'O Dashboard Discursivo implantado não corresponde ao snapshot atual.', `Main: ${expectedRedactions?.meta?.generatedAt}; site: ${liveRedactions?.meta?.generatedAt}`));
  }

  if (JSON.stringify(comparableSummary(liveRedactions?.summary)) !== JSON.stringify(comparableSummary(expectedRedactions?.summary))) {
    issues.push(issue('REDACTIONS_SUMMARY_MISMATCH', 'Os indicadores discursivos do site divergem da main.', JSON.stringify({ main: comparableSummary(expectedRedactions?.summary), site: comparableSummary(liveRedactions?.summary) })));
  }

  // A home pública é um shell estático: versão e sincronização são preenchidas em runtime por assets/common.js.
  // O monitor HTTP deve validar os hooks e a versão do motor; a renderização final é coberta pelo browser smoke em Chrome real.
  if (!String(homeHtml || '').includes('data-platform-version')) {
    issues.push(issue('HOME_VERSION_HOOK_MISSING', 'A página inicial implantada não contém o hook de versão técnica.'));
  }
  if (!String(homeHtml || '').includes('data-sync') && !String(homeHtml || '').includes('data-last-sync')) {
    issues.push(issue('HOME_SYNC_HOOK_MISSING', 'A página inicial implantada não contém hook para a última sincronização.'));
  }
  const expectedShellVersion = `const APP_SHELL_VERSION='${expectedPlatform?.platformVersion}'`;
  if (!String(commonJs || '').includes(expectedShellVersion)) {
    issues.push(issue('HOME_RUNTIME_VERSION_MISMATCH', 'O motor público da home não usa a versão técnica registrada no manifesto.', String(expectedPlatform?.platformVersion || 'ausente')));
  }
  if (!String(commonJs || '').includes("setText('[data-sync]'")) {
    issues.push(issue('HOME_RUNTIME_SYNC_MISSING', 'O motor público da home não contém a atualização runtime do indicador de sincronização.'));
  }

  if (!String(redactionsHtml || '').includes('Dashboard Discursivo')) {
    issues.push(issue('REDACTIONS_PAGE_MISSING', 'A rota pública do Dashboard Discursivo não foi confirmada.'));
  }
  if (!String(redactionsHtml || '').includes(`v=${expectedPlatform?.platformVersion}`)) {
    issues.push(issue('REDACTIONS_ASSET_VERSION_MISMATCH', 'A rota discursiva ainda referencia recursos de outra versão.', String(expectedPlatform?.platformVersion || 'ausente')));
  }

  if (lockedRd) {
    const privateFields = ['proposal', 'original', 'performance', 'feedback', 'model'];
    if (!lockedDetail || lockedDetail?.rd !== lockedRd || lockedDetail?.access?.locked !== true) {
      issues.push(issue('BLIND_APPLICATION_UNLOCKED', `A proposta futura ${lockedRd} não está protegida no site implantado.`));
    } else if (privateFields.some(field => lockedDetail[field] !== null)) {
      issues.push(issue('BLIND_APPLICATION_LEAK', `A proposta futura ${lockedRd} expõe conteúdo reservado.`, privateFields.filter(field => lockedDetail[field] !== null).join(', ')));
    }
  }

  const healthy = issues.length === 0;
  return {
    healthy,
    status: healthy ? 'healthy' : 'blocked',
    summary: healthy
      ? `GitHub Pages confirmado na publicação ${expectedPlatform?.publicationId}.`
      : 'O conteúdo implantado no GitHub Pages ainda não corresponde integralmente à main.',
    publicationId: livePlatform?.publicationId || null,
    expectedPublicationId: expectedPlatform?.publicationId || null,
    platformVersion: livePlatform?.platformVersion || null,
    peId: livePlatform?.peId || null,
    redactionsSchemaVersion: liveRedactions?.schemaVersion || null,
    lockedRd: lockedRd || null,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    issues
  };
}

async function request(url, responseType = 'json') {
  const separator = url.includes('?') ? '&' : '?';
  const response = await fetchWithTimeout(`${url}${separator}monitor=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache' }
  }, { timeoutMs: REQUEST_TIMEOUT_MS });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} em ${url}`);
  return responseType === 'text' ? response.text() : response.json();
}

async function inspectLiveSite(baseUrl, expectedPlatform, expectedRedactions) {
  const locked = (expectedRedactions?.redactions || [])
    .filter(item => item?.locked === true)
    .sort((left, right) => String(left?.date || '').localeCompare(String(right?.date || '')))[0] || null;
  const lockedRd = String(locked?.rd || '');
  const detailPath = lockedRd ? `data/redactions/${lockedRd.toLowerCase()}.json` : '';

  const [livePlatform, liveRedactions, homeHtml, commonJs, redactionsHtml, lockedDetail] = await Promise.all([
    request(`${baseUrl}/data/platform-version.json`),
    request(`${baseUrl}/data/redactions.json`),
    request(`${baseUrl}/`, 'text'),
    request(`${baseUrl}/assets/common.js`, 'text'),
    request(`${baseUrl}/redacoes/`, 'text'),
    detailPath ? request(`${baseUrl}/${detailPath}`) : Promise.resolve(null)
  ]);

  return evaluateLiveSite({
    expectedPlatform,
    expectedRedactions,
    livePlatform,
    liveRedactions,
    homeHtml,
    commonJs,
    redactionsHtml,
    lockedRd,
    lockedDetail
  });
}

function markdownReport(report) {
  const lines = [
    '## Monitoramento do site implantado',
    '',
    `- **Estado:** ${report.healthy ? 'íntegro' : 'implantação pendente ou divergente'}`,
    `- **Verificação:** ${report.checkedAtLocal}`,
    `- **Publicação esperada:** ${report.expectedPublicationId || 'ausente'}`,
    `- **Publicação no site:** ${report.publicationId || 'ausente'}`,
    `- **Versão:** ${report.platformVersion || 'ausente'}`,
    `- **PE:** ${report.peId || 'ausente'}`,
    `- **Contrato discursivo:** ${report.redactionsSchemaVersion || 'ausente'}`,
    `- **Proposta futura conferida:** ${report.lockedRd || 'nenhuma atualmente bloqueada'}`,
    `- **Timeout HTTP:** ${report.requestTimeoutMs || REQUEST_TIMEOUT_MS} ms`,
    `- **Resumo:** ${report.summary}`
  ];
  if (report.issues?.length) {
    lines.push('', '### Inconsistências');
    for (const item of report.issues) lines.push(`- **${item.code}:** ${item.message}${item.detail ? ` — ${item.detail}` : ''}`);
  }
  return lines.join('\n');
}

async function runSelfTest() {
  const expectedPlatform = {
    publicationId: '26.14.0|20.3|catalog|2026-08-06T01:17:27-03:00|abcdef',
    platformVersion: '26.14.0',
    dataVersion: '20.3',
    catalogVersion: 'catalog',
    serviceWorkerVersion: 'cache-1',
    syncAt: '2026-08-06T01:17:27-03:00',
    peId: 'PE81'
  };
  const expectedRedactions = {
    schemaVersion: '1.1',
    meta: { generatedAt: '2026-08-06T04:17:27.726Z' },
    summary: { total: 32, corrected: 12, pending: 20, average: 58.69, readiness: 48.7, scheduleAdherence: 52.2, rewriteCompletion: 0 }
  };
  const commonJs = "const APP_SHELL_VERSION='26.14.0'; setText('[data-sync]',syncAt);";
  const valid = evaluateLiveSite({
    expectedPlatform,
    expectedRedactions,
    livePlatform: structuredClone(expectedPlatform),
    liveRedactions: structuredClone(expectedRedactions),
    homeHtml: '<small data-platform-version></small><span data-sync></span>',
    commonJs,
    redactionsHtml: '<title>Dashboard Discursivo</title><script src="app.js?v=26.14.0"></script>',
    lockedRd: 'RD24',
    lockedDetail: { rd: 'RD24', access: { locked: true }, proposal: null, original: null, performance: null, feedback: null, model: null }
  });
  assert.equal(valid.healthy, true);
  assert.ok(valid.requestTimeoutMs >= 20 && valid.requestTimeoutMs <= 60000);

  const stale = evaluateLiveSite({
    expectedPlatform,
    expectedRedactions,
    livePlatform: { ...expectedPlatform, publicationId: 'old' },
    liveRedactions: structuredClone(expectedRedactions),
    homeHtml: '<small data-platform-version></small><span data-sync></span>',
    commonJs,
    redactionsHtml: '<title>Dashboard Discursivo</title><script src="app.js?v=26.14.0"></script>',
    lockedRd: 'RD24',
    lockedDetail: { rd: 'RD24', access: { locked: false }, proposal: { command: 'vazamento' }, original: null, performance: null, feedback: null, model: null }
  });
  assert.equal(stale.healthy, false);
  assert.ok(stale.issues.some(item => item.code === 'DEPLOY_PUBLICATION_MISMATCH'));
  assert.ok(stale.issues.some(item => item.code === 'BLIND_APPLICATION_UNLOCKED'));

  const missingRuntime = evaluateLiveSite({
    expectedPlatform,
    expectedRedactions,
    livePlatform: structuredClone(expectedPlatform),
    liveRedactions: structuredClone(expectedRedactions),
    homeHtml: '<main></main>',
    commonJs: '',
    redactionsHtml: '<title>Dashboard Discursivo</title><script src="app.js?v=26.14.0"></script>'
  });
  assert.equal(missingRuntime.healthy, false);
  assert.ok(missingRuntime.issues.some(item => item.code === 'HOME_VERSION_HOOK_MISSING'));
  assert.ok(missingRuntime.issues.some(item => item.code === 'HOME_RUNTIME_VERSION_MISMATCH'));
  console.log(`Monitor do GitHub Pages testado: manifesto, runtime, redações, aplicação cega e timeout HTTP de ${REQUEST_TIMEOUT_MS} ms cobertos.`);
}

if (process.env.MONITOR_SELF_TEST === 'true') {
  await runSelfTest();
} else {
  const baseUrl = normalizeBase(process.env.SITE_BASE_URL);
  const attempts = Math.max(1, Number(process.env.LIVE_SITE_MAX_ATTEMPTS || DEFAULT_ATTEMPTS));
  const delayMs = Math.max(0, Number(process.env.LIVE_SITE_RETRY_DELAY_MS || DEFAULT_DELAY_MS));
  const [expectedPlatform, expectedRedactions] = await Promise.all([
    readJson('data/platform-version.json'),
    readJson('data/redactions.json')
  ]);

  let report = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      report = await inspectLiveSite(baseUrl, expectedPlatform, expectedRedactions);
    } catch (error) {
      report = {
        healthy: false,
        status: 'unavailable',
        summary: 'O GitHub Pages não pôde ser consultado integralmente.',
        publicationId: null,
        expectedPublicationId: expectedPlatform.publicationId,
        platformVersion: null,
        peId: null,
        redactionsSchemaVersion: null,
        lockedRd: null,
        requestTimeoutMs: REQUEST_TIMEOUT_MS,
        issues: [issue('LIVE_SITE_UNAVAILABLE', error instanceof Error ? error.message : String(error))]
      };
    }
    report.attempt = attempt;
    report.attempts = attempts;
    if (report.healthy || attempt === attempts) break;
    await sleep(delayMs);
  }

  const checkedAt = new Date();
  report.checkedAt = checkedAt.toISOString();
  report.checkedAtLocal = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(checkedAt).replace(',', ' às');
  report.baseUrl = baseUrl;
  report.markdown = markdownReport(report);
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report)}\n`, 'utf8');
  console.log(report.summary);
  if (!report.healthy) process.exitCode = 1;
}
