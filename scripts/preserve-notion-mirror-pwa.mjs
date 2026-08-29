import fs from 'node:fs/promises';

const ROUTE = 'notion/';
const ASSET = 'assets/notion-mirror.js';
const HEAVY_DATA_FILE = 'data/notion-mirror/index.json';
const SUMMARY_FILE = 'data/notion-mirror/summary.json';

function updateList(source, name, {add=[],remove=[]}={}) {
  const pattern = new RegExp(`const ${name}=(\\[[^;]*\\]);`);
  const match = source.match(pattern);
  if (!match) throw new Error(`Lista ${name} ausente no Service Worker.`);
  const blocked = new Set(remove);
  const list = JSON.parse(match[1]).filter(value=>!blocked.has(value));
  for(const value of add)if(!list.includes(value))list.push(value);
  return source.replace(pattern, `const ${name}=${JSON.stringify(list)};`);
}

let sw = await fs.readFile('sw.js', 'utf8');
sw = updateList(sw, 'CORE_ROUTES', {add:[ROUTE]});
sw = updateList(sw, 'ASSETS', {add:[ASSET,'assets/notion-mirror.css']});
sw = updateList(sw, 'DATA', {remove:[HEAVY_DATA_FILE,SUMMARY_FILE]});
try {
  await fs.access(SUMMARY_FILE);
  sw = updateList(sw, 'DATA', {add:[SUMMARY_FILE]});
} catch {
  // Primeira implantação: o resumo será cacheado sob demanda até o publisher gerá-lo.
}
await fs.writeFile('sw.js', sw);
console.log('Espelho Notion preservado no PWA sem precache do índice pesado.');
