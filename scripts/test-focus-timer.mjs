
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFile(path.join(ROOT,file),'utf8');
const [timer,css,shell,sw]=await Promise.all([
 read('assets/integration/focus-timer.js'),
 read('assets/integration/focus-timer.css'),
 read('assets/integration/site-parity-v11.js'),
 read('sw.js')
]);

assert.match(timer,/export function mountFocusTimer\(\)/u);\nassert.match(timer,/if\(document\.querySelector\('\.tdas-focus-timer'\)\)return;/u);
assert.match(timer,/localStorage\.getItem\(STORAGE_KEY/u);
assert.match(timer,/status==='running'/u);
assert.match(timer,/data-focus-start/u);
assert.match(timer,/data-focus-pause/u);
assert.match(timer,/data-focus-finish/u);
assert.match(timer,/recordSession/u);
assert.match(timer,/dateKey\(finishedAt\)/u);
assert.match(css, /\.tdas-focus-timer/u);
assert.match(css, /\.tdas-focus-panel\[hidden\]/u);
assert.match(css, /max-width:780px/u);
assert.match(shell,/focus-timer\.js/u);
assert.match(shell,/focus-timer\.css/u);
assert.match(shell,/mountFocusTimer\(\)/u);
assert.match(sw,/assets\/integration\/focus-timer\.js/u);
assert.match(sw,/assets\/integration\/focus-timer\.css/u);
console.log('Cronômetro de estudo: contrato validado.');
