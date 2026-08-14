import assert from 'node:assert/strict';
import {bankFacets,buildBankCatalog,buildMergedBankKey,filterBankQuestions,flattenBankCatalogs,rebuildBankCatalogFromDraft,selectBankQuestions} from '../assets/integration/question-bank.js';

const catalogs=[
 {catalogId:'cat-a',peId:'PE01',title:'PE01',keyPath:'data/integration/question-keys/pe01.json',questions:[
  {id:'Q1',materia:'Português',assunto:'Crase',enunciado:'Questão de crase',alternativas:{A:'a',B:'b'}},
  {id:'Q2',materia:'Direito Administrativo',assunto:'Atos',enunciado:'Questão sobre anulação',alternativas:{A:'a',B:'b'}}]},
 {catalogId:'cat-b',peId:'PE02',title:'PE02',keyPath:'data/integration/question-keys/pe02.json',questions:[
  {id:'Q2',materia:'Direito Administrativo',assunto:'Atos',enunciado:'Duplicada',alternativas:{A:'a',B:'b'}},
  {id:'Q3',materia:'Português',assunto:'Regência',enunciado:'Questão de regência',alternativas:{A:'a',B:'b'}}]}
];
const rows=flattenBankCatalogs(catalogs);
assert.equal(rows.length,3,'Questões repetidas entre catálogos precisam ser deduplicadas.');
assert.equal(rows[0].sourcePe,'PE01');
assert.equal(rows[2].sourceKeyPath,'data/integration/question-keys/pe02.json');
const facets=bankFacets(rows);
assert.deepEqual(facets.pes,['PE01','PE02']);
assert.deepEqual(facets.materias,['Direito Administrativo','Português']);
assert.equal(filterBankQuestions(rows,{materia:'Português'}).length,2);
assert.equal(filterBankQuestions(rows,{query:'anulacao'}).length,1,'Busca precisa ignorar acentuação.');
assert.equal(filterBankQuestions(rows,{pe:'PE02'}).length,1);
const chosen=selectBankQuestions(rows,2,{random:false});assert.deepEqual(chosen.map(q=>q.id),['Q1','Q2']);
const random=selectBankQuestions(rows,2,{random:true,seed:123});assert.equal(random.length,2);assert.equal(new Set(random.map(q=>q.id)).size,2);
const catalog=buildBankCatalog(chosen);assert.equal(catalog.questionCount,2);assert.ok(catalog.catalogId.startsWith('tdas-bank-'));
assert.equal(buildBankCatalog(chosen).catalogId,catalog.catalogId,'A mesma seleção precisa gerar o mesmo catálogo virtual.');
const draft={catalogId:catalog.catalogId,session:{questionIds:['Q1','Q2']}};assert.equal(rebuildBankCatalogFromDraft(draft,rows)?.catalogId,catalog.catalogId);
const key=buildMergedBankKey(catalog,[{answers:[{id:'Q1',gabarito:'A'}]},{answers:[{id:'Q2',gabarito:'B'}]}]);
assert.equal(key.material_id,catalog.catalogId);assert.deepEqual(key.answers,[{id:'Q1',gabarito:'A'},{id:'Q2',gabarito:'B'}]);
assert.throws(()=>buildMergedBankKey(catalog,[{answers:[{id:'Q1',gabarito:'A'}]}]),/Gabarito ausente/);
console.log('TDAS v27: motor do Banco de Questões validado.');
