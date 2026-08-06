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
assert.match(page, /dashboard/i, 'A página deve renderizar o Dashboard Discursivo.');
const detailPage = fs.readFileSync('assets/redaction-detail.js', 'utf8');
assert.match(detailPage, /access\?\.locked/, 'A página individual deve respeitar o bloqueio da aplicação cega.');
assert.match(detailPage, /Baixar para estudo offline/, 'A página individual deve oferecer armazenamento offline.');

const payloadPath = 'data/redactions.json';
if (!fs.existsSync(payloadPath)) {
  if (strict) throw new Error('Banco Discursivo: data/redactions.json ausente na publicação.');
  console.log('Estrutura do Dashboard Discursivo validada; dados enriquecidos serão exigidos após a sincronização.');
  process.exit(0);
}
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
if (payload.schemaVersion !== '1.0') {
  if (strict) throw new Error('Banco Discursivo: snapshot ainda não foi enriquecido pelo pós-processamento.');
  console.log('Estrutura do Dashboard Discursivo validada; snapshot legado aceito apenas durante a implantação.');
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
assert.ok(payload.privacy?.futureCorrectionsExported === false, 'Correções futuras devem permanecer fora da publicação.');
if (strict) {
  const sw = fs.readFileSync('sw.js', 'utf8');
  for (const route of ['redacoes/detalhe/', 'assets/redaction-detail.js', 'assets/redactions-dashboard.css']) {
    assert.ok(sw.includes(route), `Service worker não contempla ${route}.`);
  }
}
console.log(`Banco Discursivo validado: ${details.length} RDs, dashboard, detalhes individuais, privacidade e offline.`);
