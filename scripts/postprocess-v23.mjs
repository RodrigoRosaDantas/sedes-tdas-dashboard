import fs from 'node:fs/promises';
import path from 'node:path';
import {validateGeneratedPe87EditorialContract} from './notion/pe87-editorial-contract.mjs';

const target = path.join(process.cwd(), 'data/live-v23.json');
await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, '{}\n', 'utf8');

const editorialContract=await validateGeneratedPe87EditorialContract();
console.log(JSON.stringify({ version: '23.0', overlay: 'disabled', reason: 'O snapshot atual é a única fonte pública de dados.', editorialContract }));