import assert from 'node:assert/strict';
import {DIAGNOSTIC_STORAGE_KEY,diagnosticSearchTerm,exactTopicSelection,normalizeTopicKey,parseDiagnosticTarget,readDiagnosticState,recordDiagnosticAttempt,saveDiagnosticActive,summarizeLocalDiagnostics} from '../assets/integration/edital-diagnostic.js';

class MemoryStorage{constructor(){this.map=new Map()}getItem(key){return this.map.has(key)?this.map.get(key):null}setItem(key,value){this.map.set(key,String(value))}}
const storage=new MemoryStorage();
const target=parseDiagnosticTarget('?source=edital&editalId=TDAS202:11111111111111111111111111111111&editalTopic=Reg%C3%AAncia%20verbal%20e%20nominal.&editalCode=5.6&editalDiscipline=Portugu%C3%AAs');
assert.ok(target,'Alvo diagnóstico válido não foi reconhecido.');
assert.equal(target.topic,'Regência verbal e nominal.');
assert.equal(diagnosticSearchTerm('Benefícios Eventuais — Lei Distrital 5.165/2013'),'Benefícios Eventuais','Busca inicial deve usar o rótulo principal antes do travessão.');
assert.equal(normalizeTopicKey('Regência verbal e nominal.'),'regencia verbal e nominal','Normalização lexical deve ignorar acento e pontuação sem fazer matching semântico.');
assert.equal(exactTopicSelection(target,[{assunto:'Regencia verbal e nominal'}]),true,'Correspondência lexical exata normalizada deveria ser elegível.');
assert.equal(exactTopicSelection(target,[{assunto:'Regência verbal'}]),false,'Correspondência parcial não pode virar aferição canônica.');
assert.equal(parseDiagnosticTarget('?source=edital&editalId=TDAS202:invalido&editalTopic=Teste'),null,'ID canônico inválido não pode abrir vínculo diagnóstico.');

saveDiagnosticActive({catalogId:'tdas-bank-teste',target,questionIds:['q1','q2'],measurementEligible:true},storage);
assert.equal(readDiagnosticState(storage).active['tdas-bank-teste'].measurementEligible,true,'Sessão diagnóstica ativa não foi persistida.');
recordDiagnosticAttempt({attempt:{id:'attempt:1',catalogId:'tdas-bank-teste',correct:8,total:10,percent:80,finishedAt:1000},target,measurementEligible:true},storage);
const exact=summarizeLocalDiagnostics(storage);
assert.equal(exact.measuredCount,1,'Aferição exata não apareceu no resumo local.');
assert.equal(exact.latestByTopic[target.canonicalId].percent,80,'Percentual da última aferição exata divergiu.');
assert.equal(readDiagnosticState(storage).active['tdas-bank-teste'],undefined,'Sessão ativa deveria ser encerrada ao gravar a tentativa.');

recordDiagnosticAttempt({attempt:{id:'attempt:2',catalogId:'tdas-bank-aux',correct:10,total:10,percent:100,finishedAt:2000},target,measurementEligible:false},storage);
const mixed=summarizeLocalDiagnostics(storage);
assert.equal(mixed.measuredCount,1,'Tentativa auxiliar não pode aumentar tópicos aferidos.');
assert.equal(mixed.intentOnlyCount,1,'Tentativa auxiliar deve permanecer auditável separadamente.');
assert.ok(storage.getItem(DIAGNOSTIC_STORAGE_KEY),'Sidecar diagnóstico não foi salvo.');
console.log('Fila diagnóstica validada: alvo canônico, busca assistida, matching lexical exato, sidecar local e separação entre aferição e intenção preservados.');
