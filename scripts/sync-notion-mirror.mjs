import {buildNotionMirror,writeNotionMirror} from './notion/mirror.mjs';
import {normalizeMirrorShardPaths} from './normalize-notion-mirror-paths.mjs';
const mirror=await buildNotionMirror();
await writeNotionMirror(mirror);
await normalizeMirrorShardPaths();
console.log('Espelho Notion gerado.');
