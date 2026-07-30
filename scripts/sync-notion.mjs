import { SOURCES, hash, localDate, readJson, writeJson } from './notion/config.mjs';
import { fetchMarkdown, mapLimit, queryAll } from './notion/api.mjs';
import { control, error, redaction } from './notion/normalize.mjs';
import { build } from './notion/build.mjs';

const previousState=await readJson('data/notion/state.json',{}), previousErrors=await readJson('data/notion/errors.json',{records:[]});
const oldMarkdown=new Map((previousErrors.records||[]).map(x=>[x.id,x.markdown||'']));
console.log('Consultando os três bancos oficiais do Notion...');
const [rawControls,rawErrors,rawRedactions]=await Promise.all([queryAll(SOURCES.control),queryAll(SOURCES.errors),queryAll(SOURCES.redactions)]);
const controls=rawControls.map(control).filter(x=>x.pe||x.title).sort((a,b)=>String(a.pe).localeCompare(String(b.pe))||a.id.localeCompare(b.id));
const redactions=rawRedactions.map(redaction).filter(x=>x.rd||x.theme).sort((a,b)=>String(a.rd).localeCompare(String(b.rd))||a.id.localeCompare(b.id));
const changed=rawErrors.filter(x=>previousState.pageVersions?.[x.id]!==x.last_edited_time||!oldMarkdown.has(x.id));
console.log(`Erros: ${rawErrors.length}; conteúdo novo/alterado: ${changed.length}.`);
const fresh=new Map(await mapLimit(changed,3,async x=>[x.id,await fetchMarkdown(x.id)]));
const errors=rawErrors.map(x=>error(x,fresh.get(x.id)??oldMarkdown.get(x.id)??'')).sort((a,b)=>String(a.date).localeCompare(String(b.date))||a.id.localeCompare(b.id));
const semantic={controls:controls.map(({last_edited_time,...x})=>x),errors:errors.map(({last_edited_time,markdown,...x})=>({...x,markdownHash:hash(markdown||'')})),redactions:redactions.map(({last_edited_time,...x})=>x)};
const nextHash=hash(semantic);if(previousState.semanticHash===nextHash){console.log('Nenhuma alteração semântica encontrada.');process.exit(0);}
const syncedAt=new Date().toISOString(), date=localDate(syncedAt), out=build(controls,errors,redactions,date,syncedAt);out.state.semanticHash=nextHash;
await Promise.all([
  writeJson('data/notion/control.json',{source:SOURCES.control,records:controls}),writeJson('data/notion/errors.json',{source:SOURCES.errors,records:errors}),writeJson('data/notion/redactions.json',{source:SOURCES.redactions,records:redactions}),writeJson('data/notion/state.json',out.state),writeJson('data/home.json',out.home),writeJson('data/risks.json',out.risks),writeJson('data/subjects.json',out.subjects),writeJson('data/redactions.json',out.redactionsOut)
]);
console.log(`Sincronização preparada: ${controls.length} controles, ${errors.length} erros e ${redactions.length} redações.`);
