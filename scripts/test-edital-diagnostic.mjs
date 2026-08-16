import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {DIAGNOSTIC_STORAGE_KEY,diagnosticSearchTerm,exactTopicSelection,normalizeTopicKey,parseDiagnosticTarget,readDiagnosticState,recordDiagnosticAttempt,saveDiagnosticActive,summarizeLocalDiagnostics} from '../assets/integration/edital-diagnostic.js';
import {buildDiagnosticSequence,buildEditalEvidenceSummary,diagnosticUrlForTopic,mergeRemoteDiagnosticEvidence} from '../assets/integration/edital-evidence-runtime.js';

class MemoryStorage{constructor(entries={}){this.map=new Map(Object.entries(entries))}getItem(key){return this.map.has(key)?this.map.get(key):null}setItem(key,value){this.map.set(key,String(value))}removeItem(key){this.map.delete(key)}}
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
assert.equal(readDiagnosticState(storage).active['tdas-bank-teste'],undefined,'Sessão diagnóstica ativa deveria ser encerrada ao gravar a tentativa.');

recordDiagnosticAttempt({attempt:{id:'attempt:2',catalogId:'tdas-bank-aux',correct:10,total:10,percent:100,finishedAt:2000},target,measurementEligible:false},storage);
const mixed=summarizeLocalDiagnostics(storage);
assert.equal(mixed.measuredCount,1,'Tentativa auxiliar não pode aumentar tópicos aferidos.');
assert.equal(mixed.intentOnlyCount,1,'Tentativa auxiliar deve permanecer auditável separadamente.');
assert.ok(storage.getItem(DIAGNOSTIC_STORAGE_KEY),'Sidecar diagnóstico não foi salvo.');

const historicalTarget={source:'edital',canonicalId:'TDAS202:22222222222222222222222222222222',topic:'Tópico já oficializado',code:'2',discipline:'Disciplina',searchTerm:'Tópico já officializado'};
recordDiagnosticAttempt({attempt:{id:'attempt:historical',catalogId:'tdas-bank-historical',correct:9,total:10,percent:90,finishedAt:3000},target:historicalTarget,measurementEligible:true},storage);
const pendingTopic={canonicalId:'TDAS202:33333333333333333333333333333333',id:'33333333-3333-3333-3333-333333333333',topic:'Tópico ainda sem evidência',code:'3',discipline:'Disciplina',priority:'Alta',risk:'critical',measurement:{state:'unmeasured'}};
const edital={topics:[{canonicalId:target.canonicalId,id:'11111111-1111-1111-1111-111111111111',topic:target.topic,discipline:'Português',priority:'Média',risk:'attention',measurement:{state:'unmeasured'}},{canonicalId:historicalTarget.canonicalId,id:'22222222-2222-2222-2222-222222222222',topic:historicalTarget.topic,discipline:'Disciplina',priority:'Alta',risk:'critical',measurement:{state:'measured'}},pendingTopic]};
let evidence=buildEditalEvidenceSummary({edital,storage,now:10_000_000});
assert.equal(evidence.localExactAll,2,'Histórico privado deve preservar aferições exatas antigas.');
assert.equal(evidence.localExactCurrent,1,'Aferição que já virou oficial não pode reduzir lacunas atuais duas vezes.');
assert.equal(evidence.pending,1,'Pendentes devem considerar somente aferições locais ainda ligadas a itens oficialmente sem bateria.');
assert.equal(evidence.nextDiagnostic?.canonicalId,pendingTopic.canonicalId,'Próxima bateria deve priorizar a lacuna crítica de alta prioridade.');
assert.equal(evidence.nextPlan?.suggestedCount,10,'Primeira aferição deve sugerir uma amostra inicial de 10 questões.');
assert.match(diagnosticUrlForTopic(pendingTopic,evidence.nextPlan.suggestedCount),/count=10/,'CTA diagnóstico deve carregar a quantidade sugerida.');
assert.match(diagnosticUrlForTopic(pendingTopic),/source=edital/,'CTA diagnóstico deve preservar a origem canônica.');

mergeRemoteDiagnosticEvidence([{payload:{attemptId:'attempt:remote',catalogId:'tdas-bank-remote',target:{source:'edital',canonicalId:pendingTopic.canonicalId,topic:pendingTopic.topic,code:'3',discipline:'Disciplina',searchTerm:pendingTopic.topic},measurementEligible:true,correct:6,total:10,percent:60,finishedAt:4000,recordedAt:4001}}],storage);
evidence=buildEditalEvidenceSummary({edital,storage,now:10_000_000});
assert.equal(evidence.localExactCurrent,2,'Aferição remota exata deve materializar no sidecar privado.');
assert.equal(evidence.pending,0,'Aferição remota exata deve fechar a lacuna local correspondente.');
assert.equal(evidence.intentOnly,1,'Sincronização privada não pode transformar tentativa auxiliar em aferição.');
assert.equal(evidence.lowestExact?.attempt.percent,60,'Menor aferição local deve permanecer rastreável sem virar nota oficial.');
assert.equal(evidence.nextPlan?.canonicalId,pendingTopic.canonicalId,'Resultado baixo deve continuar acionável mesmo depois da primeira aferição.');
assert.equal(evidence.nextPlan?.kind,'weak','Resultado abaixo de 75% deve pedir confirmação após revisão.');
assert.equal(evidence.nextPlan?.suggestedCount,8,'Sinal baixo com amostra inicial deve sugerir reaferição curta.');

const NOW=200_000_000;
const topic=(hex,label,risk='critical',priority='Alta')=>({canonicalId:`TDAS202:${hex.repeat(32)}`,id:`${hex.repeat(8)}-${hex.repeat(4)}-${hex.repeat(4)}-${hex.repeat(4)}-${hex.repeat(12)}`,topic:label,discipline:'Disciplina',priority,risk,measurement:{state:'unmeasured'}});
const weak=topic('4','Fraqueza confirmável'),initial=topic('5','Sem amostra'),positive=topic('6','Resultado positivo','attention','Alta'),sufficient=topic('7','Amostra suficiente'),recent=topic('8','Tentativa muito recente');
const exactAttempt=(id,item,{correct,total,percent,finishedAt})=>({attemptId:id,catalogId:`cat:${id}`,target:{source:'edital',canonicalId:item.canonicalId,topic:item.topic,code:'',discipline:item.discipline,searchTerm:item.topic},measurementEligible:true,attribution:'exact-assunto',correct,total,percent,finishedAt,recordedAt:finishedAt+1});
const sequence=buildDiagnosticSequence({now:NOW,edital:{topics:[weak,initial,positive,sufficient,recent]},diagnosticState:{attempts:[
 exactAttempt('weak',weak,{correct:5,total:10,percent:50,finishedAt:NOW-2*86_400_000}),
 exactAttempt('positive',positive,{correct:9,total:10,percent:90,finishedAt:NOW-2*86_400_000}),
 exactAttempt('sufficient-1',sufficient,{correct:9,total:10,percent:90,finishedAt:NOW-3*86_400_000}),
 exactAttempt('sufficient-2',sufficient,{correct:9,total:10,percent:90,finishedAt:NOW-2*86_400_000}),
 exactAttempt('recent',recent,{correct:4,total:10,percent:40,finishedAt:NOW-3_600_000}),
]}});
assert.equal(sequence.next?.canonicalId,weak.canonicalId,'Sinal fraco antigo deve superar lacuna inicial equivalente pela evidência de dificuldade.');
assert.equal(sequence.next?.score,95,'Score operacional deve ser soma transparente dos quatro fatores.');
assert.deepEqual(sequence.next?.breakdown,{risk:40,priority:20,sample:10,result:25});
assert.equal(sequence.next?.suggestedCount,8);
assert.equal(sequence.ready.some(row=>row.canonicalId===initial.canonicalId),true,'Tópico sem amostra deve permanecer pronto na sequência.');
assert.equal(sequence.ready.find(row=>row.canonicalId===positive.canonicalId)?.kind,'confirm-positive','Resultado bom com 10 questões deve pedir confirmação, não domínio.');
assert.equal(sequence.cooling.some(row=>row.canonicalId===recent.canonicalId),true,'Tentativa realizada há menos de 24h deve entrar em espera.');
assert.equal(sequence.ready.some(row=>row.canonicalId===recent.canonicalId),false,'Cooldown deve impedir repetição imediata do mesmo diagnóstico.');
assert.equal(sequence.sufficient.some(row=>row.canonicalId===sufficient.canonicalId),true,'Amostra positiva com 20 questões deve sair temporariamente da fila.');
assert.match(sequence.methodology,/risco oficial.*prioridade oficial.*falta de amostra.*resultado privado/i,'Metodologia da fila deve ser explicável na interface.');
assert.match(diagnosticUrlForTopic(weak,sequence.next.suggestedCount),/count=8/,'Quantidade da bateria priorizada deve chegar ao Banco.');

const [homeHtml,editalHtml,resolverHtml,mentorHtml,performanceHtml,diagnostic,runtime,pwaPreserver]=await Promise.all([
 fs.readFile('index.html','utf8'),fs.readFile('edital/index.html','utf8'),fs.readFile('resolver/index.html','utf8'),fs.readFile('mentor/index.html','utf8'),fs.readFile('desempenho/index.html','utf8'),fs.readFile('assets/integration/edital-diagnostic.js','utf8'),fs.readFile('assets/integration/edital-evidence-runtime.js','utf8'),fs.readFile('scripts/preserve-v27-pwa.mjs','utf8')
]);
for(const html of[editalHtml,resolverHtml]){
 assert.match(html,/edital-diagnostic\.css\?v=1\.0\.0/,'A camada diagnóstica perdeu o CSS compartilhado.');
 assert.match(html,/edital-diagnostic\.js\?v=1\.0\.0/,'A camada diagnóstica perdeu o controlador compartilhado.');
}
for(const html of[homeHtml,editalHtml,resolverHtml,mentorHtml,performanceHtml])assert.match(html,/edital-evidence-runtime\.js\?v=1\.0\.0/,'Uma rota operacional perdeu a camada privada de evidência do Edital.');
for(const marker of['Fila diagnóstica','Aferir no Banco','measurementEligible','exactTopicSelection','intent-only','TDAS202:'])assert.ok(diagnostic.includes(marker),`Controlador diagnóstico perdeu ${marker}.`);
for(const marker of['Evidência do Edital','Lacuna de evidência','Sua maior oportunidade agora','editalDiagnostic','queueMutableRecord','syncPrivateHistory','localExactCurrent','Sequência diagnóstica automática','Ordem operacional','COOLDOWN_MS','suggestedCount'])assert.ok(runtime.includes(marker),`Runtime de evidência perdeu ${marker}.`);
assert.match(diagnostic,/loadQuestionBank/,'Banco não valida as questões selecionadas antes de atribuir aferição.');
assert.match(diagnostic,/question\?\.assunto/,'Aferição canônica deixou de exigir o campo Assunto.');
assert.ok(!diagnostic.includes('api.notion.com')&&!runtime.includes('api.notion.com'),'Navegador não pode consultar diretamente a API do Notion.');
for(const asset of['assets/integration/edital-diagnostic.js','assets/integration/edital-diagnostic.css','assets/integration/edital-evidence-runtime.js'])assert.ok(pwaPreserver.includes(asset),`PWA pode perder ${asset} na próxima sincronização.`);
console.log(`Fila diagnóstica priorizada: ${sequence.ready.length} prontas, ${sequence.cooling.length} em espera, ${sequence.sufficient.length} com amostra suficiente; Firebase privado e separação oficial preservados.`);
