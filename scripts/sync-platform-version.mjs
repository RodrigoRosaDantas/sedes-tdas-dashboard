import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

const execFileAsync=promisify(execFile);
const VISUAL_CACHE_REV='cachefix6-pro12';
const readJSON=async(root,file)=>JSON.parse(await fs.readFile(path.join(root,file),'utf8'));
const sanitize=value=>String(value||'unknown').trim().toLowerCase().replace(/[^a-z0-9.-]+/g,'-').replace(/^-+|-+$/g,'')||'unknown';
const compactDate=value=>String(value||'').replace(/\D/g,'').slice(0,8)||'undated';
const shortCatalog=value=>{
 const clean=sanitize(value);
 return clean.match(/([a-f0-9]{12})$/)?.[1]||clean.slice(-24)||'catalog';
};
const required=(value,label)=>{
 if(value===undefined||value===null||String(value).trim()==='')throw new Error(`Versionamento: ${label} ausente.`);
 return String(value).trim();
};
function resolveSyncAt(history){
 const entry=(history?.entries||[]).find(item=>['success','no_changes'].includes(item?.status)&&item?.at);
 const syncAt=required(entry?.at,'data e hora da sincronização');
 if(Number.isNaN(Date.parse(syncAt)))throw new Error(`Versionamento: data e hora da sincronização inválida (${syncAt}).`);
 return syncAt;
}
async function resolveSourceCommit(root){
 const supplied=String(process.env.GITHUB_SHA||process.env.TDAS_SOURCE_COMMIT||'').trim();
 if(/^[0-9a-f]{40}$/i.test(supplied))return supplied.toLowerCase();
 try{
  const{stdout}=await execFileAsync('git',['rev-parse','HEAD'],{cwd:root});
  const commit=stdout.trim();
  return /^[0-9a-f]{40}$/i.test(commit)?commit.toLowerCase():'unknown';
 }catch{return'unknown'}
}
export async function buildPlatformVersion(root=process.cwd()){
 const[packageData,home,catalog,syncHistory]=await Promise.all([
  readJSON(root,'package.json'),
  readJSON(root,'data/home.json'),
  readJSON(root,'data/integration/question-catalog.json'),
  readJSON(root,'data/sync-history.json')
 ]);
 const platformVersion=required(packageData.version,'versão da plataforma');
 const dataVersion=required(home.meta?.version,'versão dos dados');
 const catalogVersion=required(catalog.catalogId,'versão do catálogo diário');
 const peId=required(catalog.peId||home.today?.pe,'PE vigente');
 const syncDate=required(home.meta?.snapshotDate,'data da sincronização');
 const syncAt=resolveSyncAt(syncHistory);
 const sourceCommit=await resolveSourceCommit(root);
 const serviceWorkerVersion=`tdas-${sanitize(platformVersion)}-${compactDate(syncDate)}-${sanitize(peId)}-${shortCatalog(catalogVersion)}-${VISUAL_CACHE_REV}`;
 const publicationId=[platformVersion,dataVersion,catalogVersion,syncAt,sourceCommit==='unknown'?'unknown':sourceCommit.slice(0,12)].join('|');
 return{schemaVersion:'1.1.0',platformVersion,dataVersion,catalogVersion,serviceWorkerVersion,sourceCommit,syncDate,syncAt,peId,publicationId};
}
function replaceConstant(source,name,value){
 const pattern=new RegExp(`const ${name}=['\"][^'\"]+['\"];`);
 if(!pattern.test(source))throw new Error(`Versionamento: constante ${name} não encontrada no service worker.`);
 return source.replace(pattern,`const ${name}=${JSON.stringify(value)};`);
}
function ensureArrayEntry(source,name,value){
 const pattern=new RegExp(`const ${name}=(\\[[^;]*\\]);`);
 const match=source.match(pattern);
 if(!match)throw new Error(`Versionamento: lista ${name} não encontrada no service worker.`);
 const list=JSON.parse(match[1]);
 if(!list.includes(value))list.push(value);
 return source.replace(pattern,`const ${name}=${JSON.stringify(list)};`);
}
export async function syncPlatformVersion(root=process.cwd()){
 const version=await buildPlatformVersion(root);
 const manifestPath=path.join(root,'data/platform-version.json');
 await fs.mkdir(path.dirname(manifestPath),{recursive:true});
 await fs.writeFile(manifestPath,`${JSON.stringify(version)}\n`,'utf8');
 const swPath=path.join(root,'sw.js');
 let sw=await fs.readFile(swPath,'utf8');
 sw=replaceConstant(sw,'VERSION',version.serviceWorkerVersion);
 sw=ensureArrayEntry(sw,'DATA','data/platform-version.json');
 await fs.writeFile(swPath,sw,'utf8');
 return version;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const version=await syncPlatformVersion();
 console.log(JSON.stringify(version));
}
