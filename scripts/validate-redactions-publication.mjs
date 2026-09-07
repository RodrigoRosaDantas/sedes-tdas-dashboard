import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validatePublicRedactions } from './notion/redactions-public.mjs';

const strict = process.env.REQUIRE_REDACTIONS_PUBLICATION === 'true';
const required = ['redacoes/index.html','redacoes/detalhe/index.html','assets/redactions.js','assets/redaction-detail.js','assets/redactions-dashboard.css','scripts/postprocess-redactions.mjs','scripts/notion/redactions-public.mjs'];
for (const file of required) assert.ok(fs.existsSync(file), `Banco Discursivo: arquivo obrigatório ausente (${file}).`);
const page=fs.readFileSync('assets/redactions.js','utf8');
assert.doesNotMatch(page,/>Não exportado</);assert.match(page,/item\.status/);assert.match(page,/data-tab="overview"/);assert.match(page,/rd-bank-cards/);assert.match(page,/clear-filters/);assert.match(page,/result-count/);assert.match(page,/action-filter/);
const detailPage=fs.readFileSync('assets/redaction-detail.js','utf8');
assert.match(detailPage,/access\?\.locked/);assert.match(detailPage,/tdas-redactions-user-v1/);assert.match(detailPage,/isSavedOffline/);assert.match(detailPage,/import\.meta\.url/);assert.match(detailPage,/split\(\/\\n\{2,\}\//);assert.match(detailPage,/rd-pager/);assert.match(detailPage,/rd-section-nav/);assert.match(detailPage,/rewriteCompleted/);assert.doesNotMatch(detailPage,/Abrir registro no Notion/);
const common=fs.readFileSync('assets/common.js','utf8');
const mobileUx=fs.readFileSync('assets/tdas-mobile-ux.js','utf8');
assert.match(mobileUx,/\['Arquivo',\[[\s\S]*\['redacoes','Redações'\]/,'Redações deve permanecer acessível dentro do Arquivo no drawer móvel.');
assert.match(mobileUx,/items=\[\['home','Pós-prova'\],\['history','Histórico'\],\['archive','Arquivo'\]\]/,'Navegação móvel principal deve ter somente três destinos.');
assert.match(common,/data-last-sync/);assert.match(common,/platform-version\.json/);assert.match(common,/Atualização atrasada/);assert.doesNotMatch(common,/navigator\.onLine\?'Atualizado'/);
const css=fs.readFileSync('assets/redactions-dashboard.css','utf8');assert.match(css,/@media\(max-width:640px\)[\s\S]*\.rd-bank-table\{display:none\}[\s\S]*\.rd-bank-cards\{display:grid/);

const payloadPath='data/redactions.json';
if(!fs.existsSync(payloadPath)){if(strict)throw new Error('Banco Discursivo: data/redactions.json ausente na publicação.');console.log('Estrutura do Dashboard Discursivo validada; dados enriquecidos serão exigidos após a sincronização.');process.exit(0)}
const payload=JSON.parse(fs.readFileSync(payloadPath,'utf8'));
if(payload.schemaVersion!=='1.1'){if(strict)throw new Error('Banco Discursivo: snapshot ainda não foi enriquecido pelo pós-processamento P0.1.');console.log('Estrutura do Dashboard Discursivo validada; snapshot anterior aceito apenas durante a implantação.');process.exit(0)}
const details=[];for(const row of payload.redactions||[]){const file=row.detailPath||`data/redactions/${String(row.rd).toLowerCase()}.json`;assert.ok(fs.existsSync(file),`Banco Discursivo: detalhe ausente para ${row.rd} (${file}).`);details.push(JSON.parse(fs.readFileSync(file,'utf8')))}
validatePublicRedactions(payload,details,{requireEnriched:true});assert.equal(payload.dashboard?.summary?.total,payload.redactions.length);assert.ok(payload.dashboard?.evolution?.every(item=>Number.isFinite(item.score)));assert.ok(payload.dashboard?.summary?.last?.date);assert.ok(Number.isFinite(payload.dashboard?.summary?.scheduleAdherence));assert.ok(Number.isFinite(payload.dashboard?.summary?.rewriteCompletion));assert.ok(payload.redactions.every(item=>'rewriteCompleted'in item));assert.ok(payload.privacy?.futureCorrectionsExported===false);
if(payload.privacy?.sourceLinksExported===false)assert.doesNotMatch(JSON.stringify({payload,details}),/https?:\/\/[^"\s]*notion\.(?:so|com)/i);
if(strict){const sw=fs.readFileSync('sw.js','utf8');for(const route of['redacoes/detalhe/','assets/redaction-detail.js','assets/redactions-dashboard.css'])assert.ok(sw.includes(route));assert.match(sw,/USER_CACHE_PREFIXES=\['tdas-redactions-user-'\]/)}
console.log(`Banco Discursivo validado: ${details.length} RDs preservadas no Arquivo, navegação v3, cronologia, leitura, privacidade e offline.`);
