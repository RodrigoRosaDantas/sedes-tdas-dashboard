import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [resolverHtml, fixes, modules, mobileUx, platform] = await Promise.all([
  fs.readFile('resolver/index.html', 'utf8'),
  fs.readFile('assets/site-parity-v11-fixes.css', 'utf8'),
  fs.readFile('assets/tdas-pro-modules.js', 'utf8'),
  fs.readFile('assets/tdas-mobile-ux.js', 'utf8'),
  fs.readFile('data/platform-version.json', 'utf8').then(JSON.parse)
]);

const rgb = value => [1, 3, 5].map(index => Number.parseInt(value.slice(index, index + 2), 16));
const luminance = value => rgb(value).map(channel => {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (foreground, background) => {
  const first = luminance(foreground), second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

assert.match(resolverHtml, /site-parity-v11-fixes\.css\?v=1\.2\.0/, 'Resolver deve carregar a camada responsiva atual sem reutilizar o CSS do Safari.');
assert.match(mobileUx, /tdas-pro-modules\.js\?v=1\.1\.1/, 'Camada de módulos deve escapar do cache da implementação que duplicava cartões.');
assert.match(platform.serviceWorkerVersion, /cachefix6-pro13$/, 'PWA deve invalidar o cache visual anterior no iPad.');

for (const marker of ['tdas-module-score', 'tdas-module-trail', 'tdas-module-command']) {
  assert.match(fixes, new RegExp(`data-question-mode="daily"[^}]*${marker}`, 's'), `Hero diário deve aplicar superfície escura em ${marker}.`);
}
for (const color of ['#f5f8f3', '#aebfbd', '#43d3aa']) {
  assert.ok(contrast(color, '#172a32') >= 4.5, `${color} deve alcançar contraste AA sobre os cartões do Resolver.`);
}

const reserve = modules.indexOf('hero.appendChild(card)');
const hydrate = modules.indexOf('card.innerHTML=await buildScorecard(key)');
assert.ok(reserve >= 0 && hydrate > reserve, 'Scorecard deve reservar um único nó antes da leitura assíncrona.');
assert.match(modules, /catch\(error\)\{card\.remove\(\);throw error\}/, 'Falha ao montar o scorecard deve remover o placeholder sem deixar bloco vazio.');

console.log('Resolver validado: contraste AA no tema claro, scorecard único e cache PRO13.');
