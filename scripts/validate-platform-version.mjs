import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {buildPlatformVersion} from './sync-platform-version.mjs';

const ROOT=process.cwd();
const read=async file=>fs.readFile(path.join(ROOT,file),'utf8');
const manifest=JSON.parse(await read('data/platform-version.json'));
const expected=await buildPlatformVersion(ROOT);
const sw=await read('sw.js');
const swVersion=sw.match(/const VERSION=['"]([^'"]+)['"]/u)?.[1]||'';
const dataList=sw.match(/const DATA=(\[[^;]*\]);/u)?.[1];

assert.equal(manifest.schemaVersion,'1.1.0');
for(const field of['platformVersion','dataVersion','catalogVersion','serviceWorkerVersion','syncDate','syncAt','peId']){
 assert.equal(manifest[field],expected[field],`${field} diverge da fonte correspondente.`);
}
assert.ok(!Number.isNaN(Date.parse(manifest.syncAt)),'syncAt inválido.');
assert.ok(/^(?:[0-9a-f]{40}|unknown)$/u.test(manifest.sourceCommit),'sourceCommit inválido.');
const commitRef=manifest.sourceCommit==='unknown'?'unknown':manifest.sourceCommit.slice(0,12);
assert.equal(manifest.publicationId,[manifest.platformVersion,manifest.dataVersion,manifest.catalogVersion,manifest.syncAt,commitRef].join('|'),'publicationId inconsistente.');
assert.equal(swVersion,manifest.serviceWorkerVersion,'service worker usa versão diferente do manifesto.');
assert.ok(dataList,'lista DATA ausente no service worker.');
assert.ok(JSON.parse(dataList).includes('data/platform-version.json'),'manifesto de versão fora do precache.');
console.log(`Versão consolidada validada: plataforma ${manifest.platformVersion}, dados ${manifest.dataVersion}, ${manifest.peId}, sincronização ${manifest.syncAt}, cache ${manifest.serviceWorkerVersion}.`);
