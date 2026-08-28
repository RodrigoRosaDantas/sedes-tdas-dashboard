import fs from'node:fs/promises';
import path from'node:path';
import{pathToFileURL}from'node:url';

export const ANSWER_KEY_NAMESPACE='tdas-cargo-202';
export const TARGET_CARGO_CODE='202';
export const TARGET_CARGO_NAME='TDAS — Técnico Administrativo';
const VALID_ANSWERS=new Set(['A','B','C','D','E','Certo','Errado']);
const text=value=>String(value??'').trim();
const safeSegment=value=>/^[a-z0-9][a-z0-9._-]{0,159}$/i.test(text(value));
const sql=value=>`'${String(value??'').replaceAll("'","''")}'`;
const integer=value=>{const parsed=Number(value);if(!Number.isInteger(parsed)||parsed<0)throw new TypeError(`Inteiro inválido: ${value}`);return parsed};
const exists=file=>fs.access(file).then(()=>true).catch(()=>false);

async function json(file){return JSON.parse(await fs.readFile(file,'utf8'))}
async function jsonFiles(directory){if(!(await exists(directory)))return[];return(await fs.readdir(directory,{withFileTypes:true})).filter(entry=>entry.isFile()&&/\.json$/i.test(entry.name)).map(entry=>path.join(directory,entry.name)).sort()}
function validatePayload(payload,label){
 if(!payload||typeof payload!=='object'||!Array.isArray(payload.answers))throw new TypeError(`${label}: payload de correção inválido.`);
 const materialId=text(payload.material_id);if(!materialId)throw new TypeError(`${label}: material_id ausente.`);
 const seen=new Set(),answers=payload.answers.map(item=>{const id=text(item?.id),gabarito=text(item?.gabarito);if(!id||seen.has(id))throw new TypeError(`${label}: questão ausente ou duplicada (${id||'sem ID'}).`);if(!VALID_ANSWERS.has(gabarito))throw new TypeError(`${label}: gabarito inválido em ${id}.`);seen.add(id);const{gabarito:ignoredAnswer,id:ignoredId,...details}=item;return{id,gabarito,details}});
 if(!answers.length)throw new TypeError(`${label}: payload de correção vazio.`);const declared=payload.questionCount==null?answers.length:integer(payload.questionCount);if(declared!==answers.length)throw new Error(`${label}: questionCount ${declared} diverge de ${answers.length}.`);
 return{materialId,contentHash:text(payload.contentHash||payload.sourceFingerprint)||null,answers};
}
function dailySet(payload,label){const normalized=validatePayload(payload,label);if(!/^tdas-pe\d+-[a-f0-9]{8,64}$/i.test(normalized.materialId))throw new TypeError(`${label}: material diário inválido.`);return{namespace:ANSWER_KEY_NAMESPACE,keyRef:`daily/${normalized.materialId}`,...normalized,source:'daily'}}
function masterSet(payload,label,allowedMaterials){const normalized=validatePayload(payload,label),materialId=normalized.materialId.replace(/^master:/,'');if(!safeSegment(materialId)||!allowedMaterials.has(materialId))return null;return{namespace:ANSWER_KEY_NAMESPACE,keyRef:`master/${materialId}`,...normalized,materialId:normalized.materialId,source:'master'}}

async function targetMaterialIds(root){
 const snapshot=await json(path.join(root,'data/integration/master-question-bank.json')),materials=Array.isArray(snapshot.materials)?snapshot.materials:[];
 const target=materials.filter(item=>text(item.codigoCargo)===TARGET_CARGO_CODE&&text(item.cargo)===TARGET_CARGO_NAME),ids=new Set(target.map(item=>text(item.id)).filter(Boolean));
 if(!ids.size)throw new Error('Banco Mestre: nenhum material do cargo TDAS 202 foi localizado.');
 const expected=target.reduce((total,item)=>total+integer(item.questionCount||0),0),declared=integer(snapshot.targetCargo?.questionCount||0);
 if(expected!==declared)throw new Error(`Banco Mestre: recorte TDAS 202 divergente (${expected} x ${declared}).`);
 return{ids,expected};
}
export async function collectPrivateAnswerKeys({root=process.cwd(),source='auto'}={}){
 const privateRoot=path.join(root,'.private/answer-keys'),publicRoot=path.join(root,'data/integration/question-keys'),usePrivate=source==='private'||(source==='auto'&&await exists(privateRoot)),base=usePrivate?privateRoot:publicRoot;
 if(!['auto','private','public'].includes(source))throw new TypeError(`Origem de correção inválida: ${source}`);
 if(source==='private'&&!(await exists(privateRoot)))throw new Error('Diretório privado de correções ausente.');
 const dailyDirectory=usePrivate?path.join(base,'daily'):base,masterDirectory=path.join(base,'master'),{ids:allowedMaterials,expected:expectedMaster}=await targetMaterialIds(root),sets=[];
 for(const file of await jsonFiles(dailyDirectory)){
  if(path.dirname(file)===publicRoot&&path.basename(file)==='master-tdas-202.json')continue;
  const payload=await json(file);if(!/^tdas-pe\d+-/i.test(text(payload?.material_id)))continue;sets.push(dailySet(payload,path.relative(root,file)));
 }
 for(const file of await jsonFiles(masterDirectory)){const set=masterSet(await json(file),path.relative(root,file),allowedMaterials);if(set)sets.push(set)}
 const seenRefs=new Set(),seenQuestions=new Set();for(const set of sets){if(seenRefs.has(set.keyRef))throw new Error(`Referência duplicada: ${set.keyRef}.`);seenRefs.add(set.keyRef);for(const item of set.answers){if(seenQuestions.has(item.id))throw new Error(`Questão repetida entre conjuntos TDAS: ${item.id}.`);seenQuestions.add(item.id)}}
 const masterCount=sets.filter(set=>set.source==='master').reduce((total,set)=>total+set.answers.length,0);if(masterCount!==expectedMaster)throw new Error(`Banco Mestre: importação TDAS 202 contém ${masterCount} respostas; esperado ${expectedMaster}.`);
 if(!sets.some(set=>set.source==='daily'))throw new Error('Correção diária atual ausente.');
 return{namespace:ANSWER_KEY_NAMESPACE,source:usePrivate?'private':'public',sets:sets.sort((a,b)=>a.keyRef.localeCompare(b.keyRef)),answerCount:sets.reduce((total,set)=>total+set.answers.length,0),masterAnswerCount:masterCount};
}
export function buildD1ImportSql(collection,{generatedAt=Math.floor(Date.now()/1000)}={}){
 if(collection?.namespace!==ANSWER_KEY_NAMESPACE||!Array.isArray(collection.sets)||!collection.sets.length)throw new TypeError('Coleção privada inválida.');
 const lines=['-- D1 executa o arquivo em transação implícita; não adicionar BEGIN/COMMIT.','PRAGMA defer_foreign_keys = true;',`DELETE FROM answer_key_sets WHERE namespace=${sql(collection.namespace)};`];
 for(const set of collection.sets){
  lines.push(`INSERT INTO answer_key_sets (namespace, key_ref, material_id, content_hash, question_count, active, updated_at) VALUES (${sql(set.namespace)}, ${sql(set.keyRef)}, ${sql(set.materialId)}, ${set.contentHash?sql(set.contentHash):'NULL'}, ${integer(set.answers.length)}, 1, ${integer(generatedAt)});`);
  for(const item of set.answers)lines.push(`INSERT INTO answer_key_items (namespace, key_ref, question_id, answer, details_json) VALUES (${sql(set.namespace)}, ${sql(set.keyRef)}, ${sql(item.id)}, ${sql(item.gabarito)}, ${sql(JSON.stringify(item.details))});`);
 }
 lines.push('PRAGMA defer_foreign_keys = false;','');return lines.join('\n');
}
export async function writeD1Import({root=process.cwd(),source='auto',output}={}){
 if(!output)throw new TypeError('Informe --output fora da árvore publicada.');
 const resolved=path.resolve(output),published=path.resolve(root,'data');if(resolved===published||resolved.startsWith(`${published}${path.sep}`))throw new Error('O SQL privado não pode ser gravado em data/.');
 const collection=await collectPrivateAnswerKeys({root,source}),contents=buildD1ImportSql(collection);await fs.mkdir(path.dirname(resolved),{recursive:true});await fs.writeFile(resolved,contents,{encoding:'utf8',mode:0o600});return{...collection,output:resolved,bytes:Buffer.byteLength(contents)};
}
function cliArgs(argv){const options={};for(let index=0;index<argv.length;index++){const token=argv[index];if(token==='--output')options.output=argv[++index];else if(token==='--source')options.source=argv[++index];else throw new TypeError(`Argumento desconhecido: ${token}`)}return options}
async function main(){const result=await writeD1Import(cliArgs(process.argv.slice(2)));console.log(`Importação privada preparada: ${result.sets.length} conjuntos · ${result.answerCount} respostas (${result.masterAnswerCount} do TDAS 202) · ${result.bytes} bytes.`)}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exit(1)});
