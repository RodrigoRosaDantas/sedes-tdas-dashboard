import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, hash, localIso, writeJson } from './config.mjs';
import { request, mapLimit } from './api.mjs';

export const MIRROR_SCHEMA='1.2.0';
export const DEFAULT_ROOT_ID='363cf5a2-6731-816e-a702-c9a8c6ea11dc';
const MAX_DEPTH=14;
const PRIVATE_PROPERTY_TYPES=new Set(['email','phone_number','people']);
const PROTECTED_SUBTREES=new Map([
 ['366cf5a2-6731-819d-acd6-d7e5b51b1339','Bancos operacionais contêm histórico pessoal, respostas, erros, redações e controles reservados.'],
 ['3accf5a2-6731-81a9-9a56-dd47d059919f','Questões que errei pertencem ao histórico pessoal de estudo.'],
 ['366cf5a2-6731-8162-a05e-d2e8b04631fc','Comandos e protocolos são material operacional interno.'],
 ['366cf5a2-6731-8121-a56f-c55de1a55efd','PDFs, apostilas e acervos podem conter material licenciado ou destinado ao workspace privado.'],
 ['366cf5a2-6731-81f9-96ce-f270b905b224','Painéis detalhados podem conter histórico pessoal de desempenho.'],
 ['366cf5a2-6731-8184-8b4d-c697645626cc','Arquivo contém versões históricas e material que não deve ser republicado automaticamente.'],
 ['364cf5a2-6731-813c-a00e-d9ba45ab6d51','Materiais Premium diários permanecem no workspace de estudo.'],
 ['364cf5a2-6731-8105-abdb-ce6966704b5d','Questões Diárias permanecem reservadas para não expor aplicação cega, respostas ou gabaritos.'],
 ['36acf5a2-6731-81fa-8fff-c8d1d4236d53','Lei Seca e Banco de Leis permanecem no workspace de estudo.'],
 ['396cf5a2-6731-810f-a8c4-f7e14c4588b4','Cadernos de prova e redação permanecem no workspace de estudo.']
]);
const SECRET_PATTERNS=[
 ['Notion token',/\b(?:secret_|ntn_)[A-Za-z0-9_-]{20,}\b/],
 ['GitHub token',/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
 ['OpenAI key',/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
 ['AWS access key',/\bAKIA[0-9A-Z]{16}\b/],
 ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/]
];
const cleanId=value=>String(value||'').replace(/-/g,'');
const plain=items=>(items||[]).map(item=>item?.plain_text??item?.text?.content??'').join('');
const safeUrl=value=>/^https?:\/\//i.test(String(value||''))?String(value):null;
const protectedReason=id=>PROTECTED_SUBTREES.get(String(id||''))||null;

function rich(items=[]){
 return items.map(item=>({
  text:item?.plain_text??item?.text?.content??'',
  href:safeUrl(item?.href||item?.text?.link?.url),
  annotations:{bold:Boolean(item?.annotations?.bold),italic:Boolean(item?.annotations?.italic),strikethrough:Boolean(item?.annotations?.strikethrough),underline:Boolean(item?.annotations?.underline),code:Boolean(item?.annotations?.code),color:item?.annotations?.color||'default'}
 })).filter(item=>item.text);
}

function propertyValue(property){
 if(!property?.type)return null;const type=property.type,v=property[type];
 if(type==='title'||type==='rich_text')return plain(v);
 if(['number','checkbox','url','created_time','last_edited_time'].includes(type))return v??null;
 if(type==='select'||type==='status')return v?.name??null;
 if(type==='multi_select')return(v||[]).map(x=>x.name);
 if(type==='date')return v?{start:v.start||null,end:v.end||null,time_zone:v.time_zone||null}:null;
 if(type==='relation')return(v||[]).map(x=>x.id);
 if(type==='files')return(v||[]).filter(file=>file.type==='external').map(file=>({name:file.name||'Arquivo',type:'external',url:safeUrl(file.external?.url)}));
 if(type==='formula')return v?{type:v.type,value:v.type==='date'?v.date:v[v.type]??null}:null;
 if(type==='rollup')return v?{type:v.type,value:v[v.type]??null}:null;
 if(type==='unique_id')return v?`${v.prefix||''}${v.number??''}`:null;
 return null;
}

function normalizeProperties(properties={}){
 return Object.fromEntries(Object.entries(properties)
  .filter(([,p])=>!PRIVATE_PROPERTY_TYPES.has(p?.type))
  .map(([name,p])=>[name,{type:p.type,value:propertyValue(p)}]));
}

function media(block,type){
 const item=block?.[type]||{};
 if(item.type!=='external')return{caption:rich(item.caption),url:null,external:false,notionHosted:true};
 return{caption:rich(item.caption),url:safeUrl(item.external?.url),external:true,notionHosted:false};
}

async function allChildren(id){
 const rows=[];let cursor=null,rounds=0;
 do{if(++rounds>1000)throw new Error(`Espelho Notion: paginação excessiva em ${id}.`);const params=new URLSearchParams({page_size:'100'});if(cursor)params.set('start_cursor',cursor);const data=await request(`/blocks/${id}/children?${params}`);if(!Array.isArray(data?.results))throw new Error(`Espelho Notion: bloco ${id} sem results.`);rows.push(...data.results);cursor=data.has_more?data.next_cursor:null;}while(cursor);
 return rows;
}

async function serializeBlock(block,ctx,depth=0){
 const type=block.type,payload=block[type]||{},base={id:block.id,type,hasChildren:Boolean(block.has_children)};
 if(type==='child_page'){ctx.pageRefs.set(block.id,{id:block.id,title:payload.title||'Página sem título'});return{...base,title:payload.title||'Página sem título',pageId:block.id};}
 if(type==='child_database'){ctx.databaseRefs.set(block.id,{id:block.id,title:payload.title||'Banco sem título'});return{...base,title:payload.title||'Banco sem título',databaseId:block.id};}
 if(['paragraph','heading_1','heading_2','heading_3','bulleted_list_item','numbered_list_item','quote','toggle'].includes(type))Object.assign(base,{richText:rich(payload.rich_text),text:plain(payload.rich_text),color:payload.color||'default'});
 else if(type==='to_do')Object.assign(base,{richText:rich(payload.rich_text),text:plain(payload.rich_text),checked:Boolean(payload.checked),color:payload.color||'default'});
 else if(type==='callout')Object.assign(base,{richText:rich(payload.rich_text),text:plain(payload.rich_text),icon:payload.icon?.emoji||null,color:payload.color||'default'});
 else if(type==='code')Object.assign(base,{richText:rich(payload.rich_text),text:plain(payload.rich_text),language:payload.language||'plain text',caption:rich(payload.caption)});
 else if(['image','file','pdf','video','audio'].includes(type))Object.assign(base,media(block,type));
 else if(type==='bookmark'||type==='embed'||type==='link_preview')Object.assign(base,{url:safeUrl(payload.url),caption:rich(payload.caption)});
 else if(type==='equation')Object.assign(base,{expression:payload.expression||''});
 else if(type==='link_to_page')Object.assign(base,{targetType:payload.type||null,targetId:payload[payload.type]||null});
 else if(type==='table')Object.assign(base,{tableWidth:Number(payload.table_width||0),hasColumnHeader:Boolean(payload.has_column_header),hasRowHeader:Boolean(payload.has_row_header)});
 else if(type==='table_row')Object.assign(base,{cells:(payload.cells||[]).map(cell=>rich(cell))});
 else if(type==='divider')return base;
 else Object.assign(base,{text:plain(payload.rich_text),richText:rich(payload.rich_text)});
 if(block.has_children&&depth<MAX_DEPTH){const children=await allChildren(block.id);base.children=[];for(const child of children)base.children.push(await serializeBlock(child,ctx,depth+1));}
 return base;
}

function titleOf(page){const entry=Object.values(page.properties||{}).find(p=>p.type==='title');return plain(entry?.title)||'Página sem título';}
function iconOf(page){return page?.icon?.type==='emoji'?page.icon.emoji:null;}
function blockSearchText(blocks=[]){const out=[];const visit=block=>{if(block?.text)out.push(block.text);for(const child of block?.children||[])visit(child)};for(const block of blocks)visit(block);return out.join(' ');}
function assertPublicSafe(file,value){const text=JSON.stringify(value);for(const[label,pattern]of SECRET_PATTERNS)if(pattern.test(text))throw new Error(`Espelho Notion: ${label} detectado em ${file}; publicação bloqueada.`);if(/(?:Gabarito correto|Você marcou:|Resposta correta:)/i.test(text))throw new Error(`Espelho Notion: resposta/gabarito detectado em ${file}; publicação bloqueada.`);}

async function mirrorDatabase(ref,parentPageId,ctx){
 if(ctx.databases.has(ref.id))return;let database;
 try{database=await request(`/databases/${ref.id}`);}catch(error){ctx.warnings.push(`Banco ${ref.title}: ${error.message}`);return;}
 const db={schemaVersion:MIRROR_SCHEMA,id:ref.id,title:database.title?plain(database.title):ref.title,url:database.url||null,parentPageId,protected:true,visibility:'metadata-only',protectionReason:'Linhas de bancos do Notion não são publicadas em GitHub Pages.',recordCount:null,dataSources:(database.data_sources||[]).map(source=>({id:source.id,name:source.name||ref.title})),shards:[]};
 ctx.databases.set(ref.id,db);ctx.files.set(`databases/${cleanId(ref.id)}/index.json`,db);
}

async function mirrorPage(pageId,parentId,ctx,depth=0){
 if(ctx.pages.has(pageId)||depth>MAX_DEPTH)return;
 const page=await request(`/pages/${pageId}`),reason=protectedReason(page.id);
 if(reason){
  const snapshot={schemaVersion:MIRROR_SCHEMA,id:page.id,title:titleOf(page),icon:iconOf(page),url:page.url,parentId,createdAt:page.created_time,lastEditedAt:page.last_edited_time,protected:true,visibility:'metadata-only',protectionReason:reason,properties:{},blocks:[],children:[],databases:[]};
  ctx.pages.set(page.id,snapshot);ctx.files.set(`pages/${cleanId(page.id)}.json`,snapshot);return;
 }
 const pageRefs=new Map(),databaseRefs=new Map(),blockCtx={pageRefs,databaseRefs},raw=await allChildren(pageId),blocks=[];for(const block of raw)blocks.push(await serializeBlock(block,blockCtx));
 const snapshot={schemaVersion:MIRROR_SCHEMA,id:page.id,title:titleOf(page),icon:iconOf(page),url:page.url,parentId,createdAt:page.created_time,lastEditedAt:page.last_edited_time,protected:false,properties:normalizeProperties(page.properties),blocks,children:[...pageRefs.values()].map(x=>x.id),databases:[...databaseRefs.values()].map(x=>x.id)};ctx.pages.set(page.id,snapshot);ctx.files.set(`pages/${cleanId(page.id)}.json`,snapshot);
 for(const ref of databaseRefs.values())await mirrorDatabase(ref,page.id,ctx);
 await mapLimit([...pageRefs.values()],3,ref=>mirrorPage(ref.id,page.id,ctx,depth+1));
}

function ancestors(pageId,pages){const out=[];let current=pages.get(pageId),guard=0;while(current?.parentId&&guard++<30){const parent=pages.get(current.parentId);if(!parent)break;out.unshift({id:parent.id,title:parent.title,icon:parent.icon});current=parent;}return out;}

export async function buildNotionMirror({rootId=process.env.NOTION_DASHBOARD_ID||DEFAULT_ROOT_ID}={}){
 const ctx={pages:new Map(),databases:new Map(),files:new Map(),warnings:[]};await mirrorPage(rootId,null,ctx);
 if(!ctx.pages.has(rootId))throw new Error('Espelho Notion: página raiz não foi coletada.');
 const generatedAt=localIso(),root=ctx.pages.get(rootId);
 const pageIndex=[...ctx.pages.values()].map(page=>({id:page.id,title:page.title,icon:page.icon,parentId:page.parentId,url:page.url,lastEditedAt:page.lastEditedAt,protected:Boolean(page.protected),protectionReason:page.protectionReason||null,children:page.children,databases:page.databases,breadcrumbs:ancestors(page.id,ctx.pages)}));
 const searchPages=[...ctx.pages.values()].map(page=>({id:page.id,title:page.title,icon:page.icon,protected:Boolean(page.protected),breadcrumbs:ancestors(page.id,ctx.pages),searchText:page.protected?page.title:[page.title,blockSearchText(page.blocks)].join(' ').slice(0,12000)}));
 const databaseIndex=[...ctx.databases.values()].map(db=>({id:db.id,title:db.title,parentPageId:db.parentPageId,url:db.url,protected:true,recordCount:null,shards:[]}));
 const protectedPageCount=pageIndex.filter(page=>page.protected).length,protectedDatabaseCount=databaseIndex.length;
 const semantic={rootId,publicScope:'safe',pages:pageIndex,databases:databaseIndex,warnings:ctx.warnings};const mirrorHash=hash(semantic);
 const index={schemaVersion:MIRROR_SCHEMA,generatedAt,publicScope:'safe',rootId,rootTitle:root.title,pageCount:pageIndex.length,protectedPageCount,databaseCount:databaseIndex.length,protectedDatabaseCount,recordCount:0,hash:mirrorHash,pages:pageIndex,databases:databaseIndex,warnings:ctx.warnings};
 const byId=new Map(pageIndex.map(page=>[page.id,page]));
 const summary={schemaVersion:MIRROR_SCHEMA,generatedAt,publicScope:'safe',rootId,rootTitle:root.title,rootUrl:root.url,pageCount:pageIndex.length,protectedPageCount,databaseCount:databaseIndex.length,protectedDatabaseCount,recordCount:0,hash:mirrorHash,warningCount:ctx.warnings.length,rootChildren:root.children.map(id=>byId.get(id)).filter(Boolean).map(page=>({id:page.id,title:page.title,icon:page.icon,protected:page.protected,childCount:page.children.length,databaseCount:page.databases.length}))};
 const search={schemaVersion:MIRROR_SCHEMA,generatedAt,publicScope:'safe',rootId,pages:searchPages};
 ctx.files.set('index.json',index);ctx.files.set('summary.json',summary);ctx.files.set('search.json',search);
 return{index,summary,search,files:ctx.files,hash:mirrorHash};
}

export async function writeNotionMirror(mirror){
 const target=path.join(ROOT,'data/notion-mirror');await fs.rm(target,{recursive:true,force:true});await fs.mkdir(target,{recursive:true});
 for(const[file,value]of mirror.files){assertPublicSafe(file,value);await writeJson(`data/notion-mirror/${file}`,value);}
 return mirror.index;
}
