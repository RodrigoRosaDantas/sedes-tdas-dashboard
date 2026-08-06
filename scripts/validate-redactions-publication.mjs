import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validatePublicRedactions } from './notion/redactions-public.mjs';

const strict = process.env.REQUIRE_REDACTIONS_PUBLICATION === 'true';
const required = [
  'redacoes/index.html',
  'redacoes/detalhe/index.html',
  'assets/redactions.js',
  'assets/redaction-detail.js',
  'assets/redactions-dashboard.css',
  'scripts/postprocess-redactions.mjs',
  'scripts/notion/redactions-public.mjs'
];
for (const file of required) assert.ok(fs.existsSync(file), `Banco Discursivo: arquivo obrigatório ausente (${file}).`);
const page = fs.readFileSync('assets/redactions.js', 'utf8');
assert.doesNotMatch(page, />Não exportado</, 'O status da redação não pode ser fixado como “Não exportado”.');
assert.match(page, /item\.status/, 'A tabela deve usar o status real exportado.');
assert.match(page, /data-tab="overview"/, 'O Dashboard Discursivo deve possuir navegação por áreas.');
assert.match(page, /rd-bank-cards/, 'O Banco Discursivo deve oferecer cartões para telas pequenas.');
assert.match(page, /clear-filters/, 'O Banco Discursivo deve permitir limpar os filtros.');
assert.match(page, /result-count/, 'O Banco Discursivo deve informar quantos registros estão visíveis.');
assert.match(page, /action-filter/, 'O Banco Discursivo deve filtrar prioridades de produção e reescrita.');
const detailPage = fs.readFileSync('assets/redaction-detail.js', 'utf8');
assert.match(detailPage, /access\?\.locked/, 'A página individual deve respeitar o bloqueio da aplicação cega.');
assert.match(detailPage, /tdas-redactions-user-v1/, 'A página individual deve usar cache offline exclusivo.');
assert.match(detailPage, /isSavedOffline/, 'O estado offline deve ser comprovado pela Cache API.');
assert.match(detailPage, /import\.meta\.url/, 'O salvamento deve usar a URL versionada real do módulo.');
assert.match(detailPage, /split\(\/\\n\{2,\}\//, 'Textos longos devem preservar parágrafos reais.');
assert.match(detailPage, /rd-pager/, 'A página individual deve permitir navegar para a RD anterior e seguinte.');
assert.match(detailPage, /rd-section-nav/, 'A página individual deve possuir índice interno de seções.');
assert.match(detailPage, /rewriteCompleted/, 'A página individual deve distinguir reescrita pendente de concluída.');
assert.doesNotMatch(detailPage, /Abrir registro no Notion/, 'A interface pública não deve expor link direto do registro editorial.');
const common = fs.readFileSync('assets/common.js', 'utf8');
assert.match(common, /const mobile=\['home','hoje','redacoes','riscos','mais'\]/, 'Redações deve permanecer visível na navegação móvel.');
assert.match(common, /data-last-sync/, 'O shell deve exibir a última sincronização real.');
assert.match(common, /platform-version\.json/, 'O shell deve consultar o manifesto técnico vigente.');
assert.match(common, /Atualização atrasada/, 'O shell deve distinguir snapshot atrasado.');
assert.doesNotMatch(common, /navigator\.onLine\?'Atualizado'/, 'Conectividade não pode ser confundida com publicação verificada.');
const css = fs.readFileSync('assets/redactions-dashboard.css', 'utf8');
assert.match(css, /@media\(max-width:640px\)[\s\S]*\.rd-bank-table\{display:none\}[\s\S]*\.rd-bank-cards\{display:grid/, 'No celular, a tabela deve ser substituída por cartões.');

const payloadPath = 'data/redactions.json';
if (!fs.existsSync(payloadPath)) {
  if (strict) throw new Error('Banco Discursivo: data/redactions.json ausente na publicação.');
  console.log('Estrutura do Dashboard Discursivo validada; dados enriquecidos serão exigidos após a sincronização.');
  process.exit(0);
}
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
if (payload.schemaVersion !== '1.1') {
  if (strict) throw new Error('Banco Discursivo: snapshot ainda não foi enriquecido pelo pós-processamento P0.1.');
  console.log('Estrutura do Dashboard Discursivo validada; snapshot anterior aceito apenas durante a implantação.');
  process.exit(0);
}
const details = [];
for (const row of payload.redactions || []) {
  const file = row.detailPath || `data/redactions/${String(row.rd).toLowerCase()}.json`;
  assert.ok(fs.existsSync(file), `Banco Discursivo: detalhe ausente para ${row.rd} (${file}).`);
  details.push(JSON.parse(fs.readFileSync(file, 'utf8')));
}
validatePublicRedactions(payload, details, { requireEnriched: true });
assert.equal(payload.dashboard?.summary?.total, payload.redactions.length, 'Resumo e índice devem ter a mesma quantidade de RDs.');
assert.ok(payload.dashboard?.evolution?.every(item => Number.isFinite(item.score)), 'A evolução deve conter apenas notas numéricas.');
assert.ok(payload.dashboard?.summary?.last?.date, 'A última nota deve informar a data cronológica usada.');
assert.ok(Number.isFinite(payload.dashboard?.summary?.scheduleAdherence), 'O cumprimento do calendário deve ser calculado.');
assert.ok(Number.isFinite(payload.dashboard?.summary?.rewriteCompletion), 'A conclusão de reescritas deve ser calculada.');
assert.ok(payload.redactions.every(item => 'rewriteCompleted' in item), 'O índice deve expor o estado objetivo da reescrita.');
assert.ok(payload.privacy?.futureCorrectionsExported === false, 'Correções futuras devem permanecer fora da publicação.');
if (payload.privacy?.sourceLinksExported === false) {
  assert.doesNotMatch(JSON.stringify({ payload, details }), /https?:\/\/[^"\s]*notion\.(?:so|com)/i, 'A publicação com privacidade reforçada não pode expor links do Notion.');
}
if (strict) {
  const sw = fs.readFileSync('sw.js', 'utf8');
  for (const route of ['redacoes/detalhe/', 'assets/redaction-detail.js', 'assets/redactions-dashboard.css']) assert.ok(sw.includes(route), `Service worker não contempla ${route}.`);
  assert.match(sw,/USER_CACHE_PREFIXES=\['tdas-redactions-user-'\]/,'O service worker deve preservar caches pessoais de redação.');
}
console.log(`Banco Discursivo validado: ${details.length} RDs, cronologia, reescrita, navegação, leitura, privacidade e offline.`);
