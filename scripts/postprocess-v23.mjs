import fs from 'node:fs/promises';
import path from 'node:path';

const target = path.join(process.cwd(), 'data/live-v23.json');
await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, '{}\n', 'utf8');

console.log(JSON.stringify({ version: '23.0', overlay: 'disabled', reason: 'O snapshot atual é a única fonte pública de dados.' }));
