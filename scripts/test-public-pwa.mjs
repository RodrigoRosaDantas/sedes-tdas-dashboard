import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = 'https://rodrigorosadantas.github.io/sedes-tdas-dashboard/';
const HOST = 'rodrigorosadantas.github.io';
const EXPECTED_CACHE = 'tdas-v26-20260801-questions1';
const ROUTES = [
  ['estudar/', 'estudar'],
  ['resolver/', 'resolver'],
  ['revisar/', 'revisar'],
  ['caderno-erros/', 'caderno-erros'],
  ['desempenho/', 'desempenho'],
  ['fila-ia/', 'fila-ia'],
];

const chromeCandidates = [
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
].filter(Boolean);
const executablePath = chromeCandidates.find(candidate => fs.existsSync(candidate));
assert.ok(executablePath, `Chrome/Chromium não encontrado. Candidatos: ${chromeCandidates.join(', ')}`);

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tdas-pwa-smoke-'));
const report = {base: BASE, cache: EXPECTED_CACHE, chrome: executablePath, profileDir, online: [], offline: []};

const launchBrowser = extraArgs => puppeteer.launch({
  executablePath,
  headless: true,
  userDataDir: profileDir,
  args: ['--no-sandbox', '--disable-dev-shm-usage', ...extraArgs],
});

const configurePage = async browser => {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(90_000);
  page.setDefaultTimeout(30_000);
  return page;
};

let browser;
try {
  browser = await launchBrowser([]);
  let page = await configurePage(browser);

  const firstResponse = await page.goto(BASE, {waitUntil: 'networkidle2'});
  assert.ok(firstResponse?.ok(), `Página inicial retornou ${firstResponse?.status() ?? 'sem resposta'}`);

  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.scope;
  });
  assert.equal(scope, BASE, `Escopo inesperado do service worker: ${scope}`);

  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload({waitUntil: 'networkidle2'});
  }
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), {timeout: 30_000});
  await page.waitForFunction(
    async expected => (await caches.keys()).includes(expected),
    {timeout: 120_000},
    EXPECTED_CACHE,
  );

  const cacheEntries = await page.evaluate(async expected => {
    const cache = await caches.open(expected);
    return (await cache.keys()).map(request => request.url);
  }, EXPECTED_CACHE);
  const requiredCached = [
    ...ROUTES.map(([route]) => `${BASE}${route}`),
    `${BASE}data/integration/pilot/pe76-catalog.json`,
    `${BASE}data/integration/pilot/pe76-key.json`,
    `${BASE}data/integration/navigation.json`,
  ];
  for (const url of requiredCached) {
    assert.ok(cacheEntries.includes(url), `Recurso obrigatório não encontrado no cache: ${url}`);
  }
  report.cachedEntries = cacheEntries.length;

  for (const [route, marker] of ROUTES) {
    const response = await page.goto(`${BASE}${route}`, {waitUntil: 'networkidle2'});
    assert.ok(response?.ok(), `${route} online retornou ${response?.status() ?? 'sem resposta'}`);
    await page.waitForFunction(expected => document.documentElement.dataset.integrationRoute === expected, {}, marker);
    if (marker === 'resolver') {
      await page.waitForFunction(() => document.body.innerText.includes('10 questões'), {timeout: 30_000});
    }
    const bodyLength = await page.evaluate(() => document.body.innerText.trim().length);
    assert.ok(bodyLength > 80, `${route} online carregou conteúdo insuficiente (${bodyLength} caracteres)`);
    report.online.push({route, status: response.status(), marker, bodyLength});
  }

  await browser.close();
  browser = undefined;

  browser = await launchBrowser([`--host-resolver-rules=MAP ${HOST} 127.0.0.1`]);
  page = await configurePage(browser);
  await page.setCacheEnabled(false);

  for (const [route, marker] of ROUTES) {
    const nonce = `${Date.now()}-${marker}`;
    const response = await page.goto(`${BASE}${route}?offline-smoke=${nonce}`, {waitUntil: 'domcontentloaded'});
    assert.ok(response, `${route} offline não retornou resposta`);
    assert.ok(response.ok(), `${route} offline retornou ${response.status()}`);
    assert.ok(response.fromServiceWorker(), `${route} offline não foi atendida pelo service worker`);
    await page.waitForFunction(expected => document.documentElement.dataset.integrationRoute === expected, {}, marker);
    if (marker === 'resolver') {
      await page.waitForFunction(() => document.body.innerText.includes('10 questões'), {timeout: 30_000});
    }
    const state = await page.evaluate(() => ({
      navigatorOnline: navigator.onLine,
      bodyLength: document.body.innerText.trim().length,
      offlineText: document.querySelector('#offline')?.textContent?.trim() || '',
    }));
    assert.ok(state.bodyLength > 80, `${route} offline carregou conteúdo insuficiente (${state.bodyLength} caracteres)`);
    report.offline.push({route, status: response.status(), fromServiceWorker: true, marker, ...state});
  }

  const networkProbe = await page.evaluate(async url => {
    try {
      const response = await fetch(url, {cache: 'no-store'});
      return {rejected: false, status: response.status, ok: response.ok};
    } catch (error) {
      return {rejected: true, message: error instanceof Error ? error.message : String(error)};
    }
  }, `${BASE}__offline-probe-${Date.now()}.txt`);
  assert.equal(networkProbe.rejected, true, `O domínio bloqueado ainda respondeu à requisição inédita: ${JSON.stringify(networkProbe)}`);
  report.networkProbe = networkProbe;

  const catalog = await page.evaluate(async url => {
    const response = await fetch(`${url}?offline-smoke=${Date.now()}`, {cache: 'no-store'});
    return {status: response.status, ok: response.ok, data: await response.json()};
  }, `${BASE}data/integration/pilot/pe76-catalog.json`);
  assert.ok(catalog.ok, `Catálogo PE76 offline retornou ${catalog.status}`);
  assert.equal(catalog.data.quantidade_questoes, 10, 'Catálogo PE76 offline não contém 10 questões');
  assert.equal(catalog.data.questoes?.length, 10, 'Lista offline do PE76 não contém 10 questões');
  report.catalogOffline = {status: catalog.status, quantidade_questoes: catalog.data.quantidade_questoes};

  console.log('SMOKE PWA PÚBLICO APROVADO');
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  fs.rmSync(profileDir, {recursive: true, force: true});
}
