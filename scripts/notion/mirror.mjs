import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, hash, localIso, writeJson } from './config.mjs';
import { request, mapLimit } from './api.mjs';

export const MIRROR_SCHEMA='1.1.0';
export const DEFAULT_ROOT_ID='363cf5a2-6731-816e-a702-c9a8c6ea11dc';
const SHARD_SIZE=150;
const MAX_DEPTH=14;
const PRIVATE_PROPERTY_TYPES=new Set(['email','phone_number','people']);
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
 if(type==='files')return(v||[]).map(file=>({name:file.name||'Arquivo',type:file.type||null,url:file.type==='external'?safeUrl(file.external?.url):null,notionHosted:file.type==='file'}));
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
 const item=block?.[type]||{},source=item.type==='external'?item.external?.url:item.file?.url;
 return{caption:rich(item.caption),url:safeUrl(source),external:item.type==='external',notionHosted:item.type==='file'};
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

function titleOf(page){
 const entry=Object.values(page.properties||{}).find(p=>p.type==='title');return plain(entry?.title)||'Página sem título';
}
function iconOf(page){return page?.icon?.type==='emoji'?page.icon.emoji:null;}
function blockSearchText(blocks=[]){const out=[];const visit=block=>{if(block?.text)out.push(block.text);for(const child of block?.children||[])visit(child)};for(const block of blocks)visit(block);return out.join(' ');}
function assertPublicSafe(file,value){const text=JSON.stringify(value);for(const[label,pattern]of SECRET_PATTERNS)if(pattern.test(text))throw new Error(`Espelho Notion: ${label} detectado em ${file}; publicação bloqueada.`);}

async function queryDataSource(dataSourceId){
 const rows=[];let cursor=null,rounds=0;
 do{if(++rounds>1000)throw new Error(`Espelho Notion: paginação excessiva no data source ${dataSourceId}.`);const body={page_size:100,...(cursor?{start_cursor:cursor}:{})};const data=await request(`/data_sources/${dataSourceId}/query`,{method:'POST',body:JSON.stringify(body)});if(!Array.isArray(data?.results))throw new Error(`Espelho Notion: data source ${dataSourceId} sem results.`);rows.push(...data.results.filter(x=>x.object==='page'));cursor=data.has_more?data.next_cursor:null;}while(cursor);
 return rows;
}

async function mirrorDatabase(ref,parentPageId,ctx){
 if(ctx.databases.has(ref.id))return;let database;
 try{database=await request(`/databases/${ref.id}`);}catch(error){ctx.warnings.push(`Banco ${ref.title}: ${error.message}`);return;}
 const sources=database.data_sources||[];const schemas=[];const records=[];
 for(const source of sources){
  try{const schema=await request(`/data_sources/${source.id}`);schemas.push({id:source.id,name:source.name||schema.name||ref.title,properties:Object.fromEntries(Object.entries(schema.properties||{}).filter(([,p])=>!PRIVATE_PROPERTY_TYPES.has(p?.type)).map(([name,p])=>[name,{id:p.id,type:p.type,name:p.name||name}]))});const pages=await queryDataSource(source.id);for(const page of pages)records.push({id:page.id,title:titleOf(page),url:page.url,createdAt:page.created_time,lastEditedAt:page.last_edited_time,properties:normalizeProperties(page.properties)});
  }catch(error){ctx.warnings.push(`Data source ${source.name||source.id}: ${error.message}`);}
 }
 const db={schemaVersion:MIRROR_SCHEMA,id:ref.id,title:database.title?plain(database.title):ref.title,description:rich(database.description),url:database.url||null,parentPageId,recordCount:records.length,dataSources:schemas,shards:[]};
 const seen=new Map(records.map(row=>[row.id,row]));const unique=[...seen.values()];for(let i=0;i<unique.length;i+=SHARD_SIZE){const part=unique.slice(i,i+SHARD_SIZE),file=`databases/${cleanId(ref.id)}/part-${String(Math.floor(i/SHARD_SIZE)+1).padStart(3,'0')}.json`;db.shards.push({file:`data/notion-mirror/${file}`,count:part.length});ctx.files.set(file,{schemaVersion:MIRROR_SCHEMA,databaseId:ref.id,records:part});}
 ctx.databases.set(ref.id,db);ctx.files.set(`databases/${cleanId(ref.id)}/index.json`,db);
}

async function mirrorPage(pageId,parentId,ctx,depth=0){
 if(ctx.pages.has(pageId)||depth>MAX_DEPTH)return;const page=await request(`/pages/${pageId}`),pageRefs=new Map(),databaseRefs=new Map(),blockCtx={pageRefs,databaseRefs},raw=await allChildren(pageId),blocks=[];for(const block of raw)blocks.push(await serializeBlock(block,blockCtx));
 const snapshot={schemaVersion:MIRROR_SCHEMA,id:page.id,title:titleOf(page),icon:iconOf(page),url:page.url,parentId,createdAt:page.created_time,lastEditedAt:page.last_edited_time,properties:normalizeProperties(page.properties),blocks,children:[...pageRefs.values()].map(x=>x.id),databases:[...databaseRefs.values()].map(x=>x.id)};ctx.pages.set(page.id,snapshot);ctx.files.set(`pages/${cleanId(page.id)}.json`,snapshot);
 for(const ref of databaseRefs.values())await mirrorDatabase(ref,page.id,ctx);
 await mapLimit([...pageRefs.values()],3,ref=>mirrorPage(ref.id,page.id,ctx,depth+1));
}

function ancestors(pageId,pages){const out=[];let current=pages.get(pageId),guard=0;while(current?.parentId&&guard++<30){const parent=pages.get(current.parentId);if(!parent)break;out.unshift({id:parent.id,title:parent.title,icon:parent.icon});current=parent;}return out;}

export async function buildNotionMirror({rootId=process.env.NOTION_DASHBOARD_ID||DEFAULT_ROOT_ID}={}){
 const ctx={pages:new Map(),databases:new Map(),files:new Map(),warnings:[]};await mirrorPage(rootId,null,ctx);
 if(!ctx.pages.has(rootId))throw new Error('Espelho Notion: página raiz não foi coletada.');
 const generatedAt=localIso(),root=ctx.pages.get(rootId);
 const pageIndex=[...ctx.pages.values()].map(page=>({id:page.id,title:page.title,icon:page.icon,parentId:page.parentId,url:page.url,lastEditedAt:page.lastEditedAt,children:page.children,databases:page.databases,breadcrumbs:ancestors(page.id,ctx.pages)}));
 const searchPages=[...ctx.pages.values()].map(page=>({id:page.id,title:page.title,icon:page.icon,breadcrumbs:ancestors(page.id,ctx.pages),searchText:[page.title,blockSearchText(page.blocks)].join(' ').slice(0,12000)}));
 const databaseIndex=[...ctx.databases.values()].map(db=>({id:db.id,title:db.title,parentPageId:db.parentPageId,url:db.url,recordCount:db.recordCount,shards:db.shards}));
 const recordCount=databaseIndex.reduce((sum,x)=>sum+x.recordCount,0);
 const semantic={rootId,pages:pageIndex,databases:databaseIndex,warnings:ctx.warnings};const mirrorHash=hash(semantic);
 const index={schemaVersion:MIRROR_SCHEMA,generatedAt,rootId,rootTitle:root.title,pageCount:pageIndex.length,databaseCount:databaseIndex.length,recordCount,hash:mirrorHash,pages:pageIndex,databases:databaseIndex,warnings:ctx.warnings};
 const byId=new Map(pageIndex.map(page=>[page.id,page]));
 const summary={schemaVersion:MIRROR_SCHEMA,generatedAt,rootId,rootTitle:root.title,rootUrl:root.url,pageCount:pageIndex.length,databaseCount:databaseIndex.length,recordCount,hash:mirrorHash,warningCount:ctx.warnings.length,rootChildren:root.children.map(id=>byId.get(id)).filter(Boolean).map(page=>({id:page.id,title:page.title,icon:page.icon,childCount:page.children.length,databaseCount:page.databases.length}))};
 const search={schemaVersion:MIRROR_SCHEMA,generatedAt,rootId,pages:searchPages};
 ctx.files.set('index.json',index);ctx.files.set('summary.json',summary);ctx.files.set('search.json',search);
 return{index,summary,search,files:ctx.files,hash:mirrorHash};
}

export async function writeNotionMirror(mirror){
 const target=path.join(ROOT,'data/notion-mirror');await fs.rm(target,{recursive:true,force:true});await fs.mkdir(target,{recursive:true});
 for(const[file,value]of mirror.files){assertPublicSafe(file,value);await writeJson(`data/notion-mirror/${file}`,value);}
 return mirror.index;
}
