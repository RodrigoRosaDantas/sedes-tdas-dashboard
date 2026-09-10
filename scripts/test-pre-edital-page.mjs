import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const html = read('pre-edital/index.html');
const script = read('assets/integration/pre-edital-home.js');
const common = read('assets/common.js');
const parity = read('assets/integration/site-parity-v11.js');
const post = read('assets/integration/post-exam-home.js');
const more = read('assets/more.js');

assert.match(html, /pre-edital-home\.js/);
assert.match(html, /Radar pré-edital SEDES\/DF/);
assert.match(script, /Técnico Administrativo · Cargo 202/);
assert.match(script, /Administrador · Cargo 400/);
assert.match(script, /aguardando fonte oficial/);
assert.match(common, /preedital:BASE\+'pre-edital\//);
assert.match(parity, /id:'pre-edital'/);
assert.match(parity, /'\/pre-edital\/':'pre-edital'/);
assert.match(post, /href="\$\{BASE\}pre-edital\//);
assert.match(more, /Pré-edital SEDES\/DF/);
if (/NOTION_TOKEN|SUPABASE_ACCESS_TOKEN|sbp_|ntn_/.test(script)) throw new Error('Segredo encontrado no radar público.');

console.log(JSON.stringify({preEdital:true,independentFromPostExam:true,secretScan:'ok'}));
