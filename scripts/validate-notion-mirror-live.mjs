import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const index=JSON.parse(await fs.readFile('data/notion-mirror/index.json','utf8'));
assert.equal(index.rootId,'363cf5a2-6731-816e-a702-c9a8c6ea11dc');
assert.ok(!index.bootstrap);
assert.ok(index.pageCount>=20);
assert.ok(index.databaseCount>=3);
assert.equal(new Set(index.pages.map(x=>x.id)).size,index.pages.length);
for(const page of index.pages){
  const file=`data/notion-mirror/pages/${page.id.replace(/-/g,'')}.json`;
  const source=await fs.readFile(file,'utf8');
  assert.ok(!/"notionHosted":true[^}]*"url":"https?:/i.test(source),`URL temporária do Notion exposta em ${file}`);
}
console.log(`Espelho real: ${index.pageCount} páginas, ${index.databaseCount} bancos, ${index.recordCount} registros.`);
