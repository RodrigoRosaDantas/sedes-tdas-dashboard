import assert from 'node:assert/strict';
import {request} from './notion/api.mjs';

const rootId='363cf5a2-6731-816e-a702-c9a8c6ea11dc';
const expected=new Set([
 '366cf5a2-6731-8195-9f8d-ca36b606e78a',
 '366cf5a2-6731-819f-8f43-f82bd74fda2d',
 '366cf5a2-6731-819d-acd6-d7e5b51b1339',
 '366cf5a2-6731-8162-a05e-d2e8b04631fc',
 '366cf5a2-6731-8121-a56f-c55de1a55efd',
 '366cf5a2-6731-81f9-96ce-f270b905b224'
]);
const page=await request(`/pages/${rootId}`);
assert.equal(page.id,rootId);
const blocks=await request(`/blocks/${rootId}/children?page_size=100`);
const children=new Set((blocks.results||[]).filter(x=>x.type==='child_page').map(x=>x.id));
for(const id of expected)assert.ok(children.has(id),`Pasta principal ausente no Notion: ${id}`);
for(const id of [...expected].slice(0,3)){const child=await request(`/pages/${id}`);assert.equal(child.object,'page');}
const banksId='366cf5a2-6731-819d-acd6-d7e5b51b1339';
const bankBlocks=await request(`/blocks/${banksId}/children?page_size=100`);
const database=(bankBlocks.results||[]).find(x=>x.type==='child_database');
assert.ok(database,'Nenhum banco filho encontrado em Bancos operacionais.');
const db=await request(`/databases/${database.id}`);
assert.ok((db.data_sources||[]).length,'Banco sem data source disponível.');
const source=db.data_sources[0];
const sample=await request(`/data_sources/${source.id}/query`,{method:'POST',body:JSON.stringify({page_size:1})});
assert.ok(Array.isArray(sample.results),'Consulta de data source não retornou results.');
console.log(`Smoke Notion aprovado: raiz + ${expected.size} áreas + banco ${database.id}.`);
