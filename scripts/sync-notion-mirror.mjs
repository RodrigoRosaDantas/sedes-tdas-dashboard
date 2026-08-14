import {buildNotionMirror,writeNotionMirror} from './notion/mirror.mjs';
const mirror=await buildNotionMirror();
await writeNotionMirror(mirror);
console.log(`Espelho Notion: ${mirror.index.pageCount} páginas, ${mirror.index.databaseCount} bancos, ${mirror.index.recordCount} registros.`);
