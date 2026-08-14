import fs from 'node:fs/promises';

const publicPath='data/integration/master-question-bank.json';
const keyPath='data/integration/question-keys/master-tdas-202.json';
const exists=await fs.access(publicPath).then(()=>true).catch(()=>false);
if(!exists){console.log('Banco Mestre TDAS ainda não materializado neste checkout; validação estrutural será executada após a sincronização.');process.exit(0)}
const catalog=JSON.parse(await fs.readFile(publicPath,'utf8'));
const key=JSON.parse(await fs.readFile(keyPath,'utf8'));
const required=(condition,message)=>{if(!condition)throw new Error(`Banco Mestre TDAS: ${message}`)};
required(catalog.schemaVersion==='1.0.0'&&catalog.mode==='tdas-master-question-bank','contrato público inválido.');
required(catalog.cargo?.code==='202'&&catalog.cargo?.name==='TDAS — Técnico Administrativo','recorte de cargo divergente.');
required(Number(catalog.questionCount)>=570,'quantidade abaixo do piso histórico de 570 questões.');
required(catalog.questionCount===catalog.questions.length,'questionCount divergente.');
required(catalog.materialCount===catalog.materials.length,'materialCount divergente.');
required(catalog.keyPath===keyPath,'caminho da chave divergente.');
required(!JSON.stringify(catalog).includes('"gabarito"'),'catálogo público expõe gabarito.');
const ids=new Set();
for(const question of catalog.questions){
 required(question.id&&!ids.has(question.id),`id ausente ou duplicado: ${question.id}`);ids.add(question.id);
 required(question.cargo==='TDAS — Técnico Administrativo'&&question.codigoCargo==='202',`questão fora do recorte: ${question.id}`);
 required(question.sourceKind==='master-bank'&&question.sourceKeyPath===keyPath,`origem inválida: ${question.id}`);
 required(question.enunciado&&['A','B','C','D','E'].every(option=>question.alternativas?.[option]),`conteúdo incompleto: ${question.id}`);
}
required(key.questionCount===catalog.questionCount&&key.answers.length===catalog.questionCount,'chave incompleta.');
const answers=new Map(key.answers.map(item=>[item.id,item.gabarito]));
for(const id of ids)required(['A','B','C','D','E'].includes(answers.get(id)),`gabarito inválido/ausente em ${id}.`);
const sw=await fs.readFile('sw.js','utf8');
required(!sw.includes(keyPath),'gabarito entrou no service worker.');
if(sw.includes(publicPath))required(sw.includes('master-question-bank.json'),'referência PWA inconsistente.');
console.log(`Banco Mestre TDAS validado: ${catalog.questionCount} questões, ${catalog.materialCount} materiais, catálogo cego e chave fora do precache.`);
