import fs from 'node:fs/promises';
import path from 'node:path';
const ROOT=process.cwd();
const REQUIRED=['assets/integration/question-telemetry.js','assets/integration/question-telemetry-runtime.js','assets/integration/module-performance-v4.js'];
function ensureArrayEntry(source,name,value){const pattern=new RegExp(`const ${name}=(\\[[^;]*\\]);`),match=source.match(pattern);if(!match)throw new Error(`Telemetria PWA: lista ${name} ausente.`);const list=JSON.parse(match[1]);if(!list.includes(value))list.push(value);return source.replace(pattern,`const ${name}=${JSON.stringify(list)};`)}
const swPath=path.join(ROOT,'sw.js');let sw=await fs.readFile(swPath,'utf8');for(const asset of REQUIRED)sw=ensureArrayEntry(sw,'ASSETS',asset);await fs.writeFile(swPath,sw,'utf8');
for(const file of REQUIRED)await fs.access(path.join(ROOT,file));
console.log(`Telemetria PWA preservada: ${REQUIRED.length} assets locais, sem backend externo.`);
