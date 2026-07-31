import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BASE = '/sedes-tdas-dashboard/';
const expected = ['estudar', 'resolver', 'revisar', 'caderno-erros', 'desempenho', 'fila-ia'];
const read = file => fs.readFile(path.join(ROOT, file), 'utf8');
const readJson = async file => JSON.parse(await read(file));
const exists = file => fs.access(path.join(ROOT, file)).then(() => true).catch(() => false);
const required = (condition, message) => { if (!condition) throw new Error(message); };

const navigation = await readJson('data/integration/navigation.json');
required(navigation.schemaVersion === '1.0.0', 'Versão do contrato de navegação inválida.');
required(navigation.phase === 2 && navigation.mode === 'navigation-only', 'Contrato fora da Fase 2.');
required(navigation.basePath === BASE, 'Base da navegação inválida.');
required(Array.isArray(navigation.routes) && navigation.routes.length === expected.length, 'Quantidade de rotas inválida.');
required(JSON.stringify(navigation.routes.map(route => route.key)) === JSON.stringify(expected), 'Ordem ou chaves das rotas divergentes.');
required(new Set(navigation.routes.map(route => route.path)).size === expected.length, 'Há caminhos duplicados.');

for (const route of navigation.routes) {
  required(route.path === `${BASE}${route.key}/`, `Caminho divergente para ${route.key}.`);
  required(await exists(`${route.key}/index.html`), `HTML ausente para ${route.key}.`);
  const html = await read(`${route.key}/index.html`);
  required(html.includes(`data-integration-route="${route.key}"`), `${route.key}: identificador estrutural ausente.`);
  required(html.includes(`${BASE}assets/integration/navigation.js`), `${route.key}: script de navegação ausente.`);
}

const script = await read('assets/integration/navigation.js');
required(!/localStorage|sessionStorage|indexedDB/.test(script), 'A Fase 2 não pode gravar dados locais.');
required(!/notion\.com|api\.notion/.test(script), 'A Fase 2 não pode acessar o Notion.');
required(script.includes("BASE + 'questoes-erros/'"), 'Atalho para o caderno oficial atual ausente.');

const home = await read('assets/home.js');
const more = await read('assets/more.js');
required(home.includes("const STUDY_BASE='/sedes-tdas-dashboard/'") && home.includes('${STUDY_BASE}estudar/'), 'A página inicial não aponta para Estudar.');
for (const key of expected) required(more.includes('`${BASE}' + key + '/`'), `Mais não aponta para ${key}.`);
required(await exists('questoes-erros/index.html'), 'A rota legada de questões erradas foi removida.');

console.log(`Navegação da Fase 2 validada: ${expected.length} rotas, sem persistência e com rota legada preservada.`);
