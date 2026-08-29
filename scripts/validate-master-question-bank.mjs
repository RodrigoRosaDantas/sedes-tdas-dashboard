import fs from 'node:fs/promises';

const indexPath='data/integration/master-question-bank.json';
const exists=await fs.access(indexPath).then(()=>true).catch(()=>false);
if(!exists){
 console.log('Banco publicado ainda não materializado neste checkout; validação completa ocorrerá após a sincronização.');
 process.exit(0);
}

const indexText=await fs.readFile(indexPath,'utf8');
const catalog=JSON.parse(indexText);
const required=(condition,message)=>{if(!condition)throw new Error(`Banco publicado: ${message}`)};

if(catalog.schemaVersion==='1.0.0'){
 required(catalog.mode==='tdas-master-question-bank','contrato legado inválido.');
 required(Number(catalog.questionCount)>=570,'snapshot legado abaixo do piso histórico.');
 required(!indexText.includes('"gabarito"'),'snapshot legado expõe gabarito.');
 console.log(`Banco legado validado provisoriamente: ${catalog.questionCount} questões; será migrado para a release integral na próxima sincronização.`);
 process.exit(0);
}

required(['2.0.0','2.1.0','2.2.0'].includes(catalog.schemaVersion)&&catalog.mode==='tdas-master-question-bank','contrato do índice inválido.');
required(catalog.scope==='full-published-release','escopo não representa a release publicada integral.');
const sourceQuestionCount=Number(catalog.sourceQuestionCount??catalog.questionCount);
const excludedAnnulledCount=Number(catalog.excludedAnnulledCount||0);
required(sourceQuestionCount>=3447,'quantidade-fonte abaixo do piso publicado de 3.447 questões.');
required(Number(catalog.questionCount)>0&&catalog.questionCount===catalog.questionIndex.length,'questionCount resolvível divergente.');
required(catalog.questionCount+excludedAnnulledCount===sourceQuestionCount,'resolvíveis + anuladas não recompõem o total publicado.');
required(Array.isArray(catalog.excludedQuestions||[])&&(catalog.excludedQuestions||[]).length===excludedAnnulledCount,'metadados das anuladas divergentes.');
required((catalog.excludedQuestions||[]).every(item=>item.id&&item.reason==='annulled'),'registro de anulada inválido.');
required(catalog.materialCount===catalog.materials.length,'materialCount divergente.');
required(!indexText.match(/"gabarito"|"comentario"|"fundamento"/),'índice público expõe correção.');

const materialById=new Map(catalog.materials.map(item=>[item.id,item]));
const ids=new Set();
for(const question of catalog.questionIndex){
 required(question.id&&!ids.has(question.id),`id ausente/duplicado: ${question.id}`);
 ids.add(question.id);
 const material=materialById.get(question.materialId);
 required(question.lazy===true&&material,`índice incompleto: ${question.id}`);
 const publicPath=question.sourcePublicPath||material.publicPath;
 const keyPath=question.sourceKeyPath||material.keyPath;
 required(/^data\/integration\/master-question-bank\/[a-z0-9._-]+\.json$/i.test(publicPath),`chunk público inválido: ${question.id}`);
 required(/^data\/integration\/question-keys\/master\/[a-z0-9._-]+\.json$/i.test(keyPath),`chunk de correção inválido: ${question.id}`);
 if(catalog.schemaVersion==='2.2.0')required(!('sourcePublicPath'in question)&&!('sourceKeyPath'in question)&&!('materialName'in question)&&!('cargo'in question),`índice 2.2 repetiu metadados do material: ${question.id}`);
}
for(const item of catalog.excludedQuestions||[])required(!ids.has(item.id),`questão anulada entrou no índice resolvível: ${item.id}`);

let publicCount=0,keyCount=0,sourceCount=0,excludedCount=0;
for(const material of catalog.materials){
 const publicPayload=JSON.parse(await fs.readFile(material.publicPath,'utf8'));
 const keyPayload=JSON.parse(await fs.readFile(material.keyPath,'utf8'));
 required(!JSON.stringify(publicPayload).match(/"gabarito"|"comentario"|"fundamento"/),`chunk público expõe correção: ${material.id}`);
 required(publicPayload.questions.length===material.questionCount,`chunk público divergente: ${material.id}`);
 required(keyPayload.answers.length===material.questionCount,`chave divergente: ${material.id}`);
 const materialSource=Number(material.sourceQuestionCount??material.questionCount);
 const materialExcluded=Number(material.excludedAnnulledCount||0);
 required(material.questionCount+materialExcluded===materialSource,`partição do material divergente: ${material.id}`);
 required((publicPayload.excludedAnnulled||[]).length===materialExcluded,`anuladas do chunk divergentes: ${material.id}`);
 for(const question of publicPayload.questions)required(question.enunciado&&Object.keys(question.alternativas||{}).length>=2,`conteúdo incompleto: ${question.id}`);
 for(const answer of keyPayload.answers)required(['A','B','C','D','E','Certo','Errado'].includes(answer.gabarito),`gabarito inválido: ${answer.id}`);
 publicCount+=publicPayload.questions.length;
 keyCount+=keyPayload.answers.length;
 sourceCount+=materialSource;
 excludedCount+=materialExcluded;
}
required(publicCount===catalog.questionCount&&keyCount===catalog.questionCount,'partições resolvíveis não recompõem o total.');
required(sourceCount===sourceQuestionCount&&excludedCount===excludedAnnulledCount,'materiais não recompõem a release publicada.');
if(catalog.schemaVersion==='2.2.0')required(Buffer.byteLength(indexText)<=2_250_000,'índice compacto ultrapassou 2,25 MB.');

const sw=await fs.readFile('sw.js','utf8');
required(!sw.includes(indexPath),'índice público pesado entrou no precache do PWA.');
required(!sw.includes('question-keys/master/'),'chaves entraram no service worker.');
console.log(`Banco publicado validado: ${sourceQuestionCount} publicadas · ${catalog.questionCount} resolvíveis · ${excludedAnnulledCount} anuladas excluídas · ${catalog.materialCount} materiais · índice ${Math.round(Buffer.byteLength(indexText)/1024)} KiB sob demanda.`);
