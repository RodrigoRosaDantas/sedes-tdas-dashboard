import assert from'node:assert/strict';
import fs from'node:fs/promises';
import os from'node:os';
import path from'node:path';
import{buildD1ImportSql,collectPrivateAnswerKeys,TARGET_CARGO_CODE,TARGET_CARGO_NAME}from'./answer-key-private-store.mjs';

const collection=await collectPrivateAnswerKeys();
const catalog=JSON.parse(await fs.readFile('data/integration/question-catalog.json','utf8'));
const snapshot=JSON.parse(await fs.readFile('data/integration/master-question-bank.json','utf8'));
const expectedMaster=snapshot.materials.filter(item=>String(item.codigoCargo)===TARGET_CARGO_CODE&&String(item.cargo)===TARGET_CARGO_NAME).reduce((total,item)=>total+Number(item.questionCount||0),0);
assert.equal(collection.namespace,'tdas-cargo-202');
assert.equal(collection.source,'public');
assert.equal(collection.masterAnswerCount,expectedMaster,'Somente o recorte exato TDAS 202 deve ir ao backend.');
assert.equal(collection.answerCount,expectedMaster+catalog.questionCount,'A importação deve reunir Banco TDAS e PE diário atual.');
assert.ok(collection.sets.every(set=>set.source==='daily'||set.keyRef.startsWith('master/')));
assert.ok(collection.sets.filter(set=>set.source==='master').every(set=>snapshot.materials.some(item=>item.id===set.keyRef.slice('master/'.length)&&item.codigoCargo===TARGET_CARGO_CODE&&item.cargo===TARGET_CARGO_NAME)),'EDAS 400 e demais cargos não podem entrar no namespace TDAS 202.');
const generatedAt=1_777_000_000,sql=buildD1ImportSql(collection,{generatedAt});
assert.match(sql,/^-- D1 executa o arquivo em transação implícita; não adicionar BEGIN\/COMMIT\.\nPRAGMA defer_foreign_keys = true;/);
assert.match(sql,/DELETE FROM answer_key_sets WHERE namespace='tdas-cargo-202';/,'A importação deve retirar conjuntos obsoletos dentro da mesma transação.');
assert.match(sql,/\nPRAGMA defer_foreign_keys = false;\n$/);
assert.ok(!/^BEGIN TRANSACTION;$/m.test(sql)&&!/^COMMIT;$/m.test(sql),'O importador D1 já cria a transação e rejeita transações aninhadas.');
assert.ok(!sql.includes('data/integration/question-keys'),'O armazenamento não deve persistir caminhos públicos legados.');
assert.equal((sql.match(/INSERT INTO answer_key_items/g)||[]).length,collection.answerCount);

const temp=await fs.mkdtemp(path.join(os.tmpdir(),'tdas-private-store-'));
try{
 const fixtureRoot=path.join(temp,'fixture');await fs.mkdir(path.join(fixtureRoot,'data/integration/question-keys/master'),{recursive:true});
 await fs.mkdir(path.join(fixtureRoot,'data/integration/question-keys'),{recursive:true});
 await fs.writeFile(path.join(fixtureRoot,'data/integration/master-question-bank.json'),JSON.stringify({targetCargo:{questionCount:1},materials:[{id:'tdas-one',codigoCargo:'202',cargo:TARGET_CARGO_NAME,questionCount:1},{id:'edas-one',codigoCargo:'400',cargo:'EDAS — Administração',questionCount:1}]}));
 await fs.writeFile(path.join(fixtureRoot,'data/integration/question-keys/pe101.json'),JSON.stringify({material_id:'tdas-pe101-abcdef123456',answers:[{id:'PE101-Q001',gabarito:'C'}]}));
 await fs.writeFile(path.join(fixtureRoot,'data/integration/question-keys/master/tdas-one.json'),JSON.stringify({material_id:'master:tdas-one',questionCount:1,answers:[{id:'TDAS-1',gabarito:'A',comentario:"Regra d'ouro"}]}));
 await fs.writeFile(path.join(fixtureRoot,'data/integration/question-keys/master/edas-one.json'),JSON.stringify({material_id:'master:edas-one',questionCount:1,answers:[{id:'EDAS-1',gabarito:'B'}]}));
 const fixture=await collectPrivateAnswerKeys({root:fixtureRoot,source:'public'});assert.equal(fixture.answerCount,2);assert.ok(!JSON.stringify(fixture).includes('EDAS-1'));
 const fixtureSql=buildD1ImportSql(fixture,{generatedAt});assert.match(fixtureSql,/Regra d''ouro/,'Apóstrofos devem ser escapados no SQL.');
}finally{await fs.rm(temp,{recursive:true,force:true})}

console.log(`Backend privado preparado: ${collection.sets.length} conjuntos e ${collection.answerCount} respostas; EDAS 400 isolado.`);
