import fs from 'node:fs/promises';

const ROUTE = 'notion/';
const ASSET = 'assets/notion-mirror.js';
const DATA_FILE = 'data/notion-mirror/index.json';

function addToList(source, name, value) {
  const pattern = new RegExp(`const ${name}=(\\[[^;]*\\]);`);
  const match = source.match(pattern);
  if (!match) throw new Error(`Lista ${name} ausente no Service Worker.`);
  const list = JSON.parse(match[1]);
  if (!list.includes(value)) list.push(value);
  return source.replace(pattern, `const ${name}=${JSON.stringify(list)};`);
}

let sw = await fs.readFile('sw.js', 'utf8');
sw = addToList(sw, 'CORE_ROUTES', ROUTE);
sw = addToList(sw, 'ASSETS', ASSET);
sw = addToList(sw, 'ASSETS', 'assets/notion-mirror.css');
sw = addToList(sw, 'ASSETS', 'assets/integration/home-notion-mirror.js');
sw = addToList(sw, 'DATA', DATA_FILE);
await fs.writeFile('sw.js', sw);
console.log('Espelho Notion preservado no PWA.');
