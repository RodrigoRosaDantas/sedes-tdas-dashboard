import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const BASE='/sedes-tdas-dashboard/';
const SKIP_PREFIXES=['http:','https:','mailto:','tel:','javascript:','data:','blob:','//'];

async function walk(directory='.'){
 const entries=await fs.readdir(path.join(ROOT,directory),{withFileTypes:true});
 const files=[];
 for(const entry of entries){
  if(entry.name==='.git'||entry.name==='node_modules')continue;
  const relative=path.join(directory,entry.name);
  if(entry.isDirectory())files.push(...await walk(relative));
  else files.push(relative.replace(/^\.\//,''));
 }
 return files;
}

function localTarget(sourceFile,reference){
 const clean=String(reference||'').trim();
 if(!clean||clean.startsWith('#')||SKIP_PREFIXES.some(prefix=>clean.toLowerCase().startsWith(prefix)))return null;
 const pathname=clean.split('#')[0].split('?')[0];
 if(!pathname)return null;
 let relative;
 if(pathname.startsWith(BASE))relative=pathname.slice(BASE.length);
 else if(pathname.startsWith('/'))return null;
 else relative=path.normalize(path.join(path.dirname(sourceFile),pathname));
 try{relative=decodeURIComponent(relative)}catch{}
 relative=relative.replace(/^\.\//,'');
 if(!relative||relative.endsWith('/'))return path.join(relative,'index.html');
 if(!path.extname(relative))return path.join(relative,'index.html');
 return relative;
}

const files=await walk();
const fileSet=new Set(files);
const htmlFiles=files.filter(file=>file.endsWith('.html'));
const jsonFiles=files.filter(file=>file.endsWith('.json'));
const broken=[];
const duplicateIds=[];
const missingDocumentMeta=[];
const missingDocumentStructure=[];
const missingImageAlt=[];
const unsafeBlankLinks=[];

for(const file of htmlFiles){
 const html=await fs.readFile(path.join(ROOT,file),'utf8');
 const ids=[...html.matchAll(/\sid=["']([^"']+)["']/giu)].map(match=>match[1]);
 const duplicates=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
 if(duplicates.length)duplicateIds.push({file,ids:duplicates});
 if(!/<html\b[^>]*\blang=["']pt-BR["']/iu.test(html)||!/<meta\b[^>]*name=["']viewport["']/iu.test(html)||!/<title>[^<]+<\/title>/iu.test(html))missingDocumentMeta.push(file);
 if(!/<main\b/iu.test(html)||!/<h1\b/iu.test(html))missingDocumentStructure.push(file);
 for(const match of html.matchAll(/<img\b([^>]*)>/giu))if(!/\balt=["'][^"']*["']/iu.test(match[1]))missingImageAlt.push(file);
 for(const match of html.matchAll(/<a\b([^>]*)>/giu))if(/\btarget=["']_blank["']/iu.test(match[1])&&!/\brel=["'][^"']*\bnoopener\b[^"']*["']/iu.test(match[1]))unsafeBlankLinks.push(file);
 for(const match of html.matchAll(/\s(?:href|src)=["']([^"']+)["']/giu)){
  const target=localTarget(file,match[1]);
  if(target&&!fileSet.has(target))broken.push({file,reference:match[1],target});
 }
}

const invalidJson=[];
for(const file of jsonFiles){
 try{JSON.parse(await fs.readFile(path.join(ROOT,file),'utf8'))}
 catch(error){invalidJson.push({file,error:error.message})}
}

assert.deepEqual(broken,[],`Referências internas quebradas:\n${broken.map(item=>`${item.file}: ${item.reference} -> ${item.target}`).join('\n')}`);
assert.deepEqual(duplicateIds,[],`IDs duplicados:\n${duplicateIds.map(item=>`${item.file}: ${item.ids.join(', ')}`).join('\n')}`);
assert.deepEqual(missingDocumentMeta,[],`Documentos sem idioma, viewport ou título: ${missingDocumentMeta.join(', ')}`);
assert.deepEqual(missingDocumentStructure,[],`Documentos sem main ou h1: ${missingDocumentStructure.join(', ')}`);
assert.deepEqual(missingImageAlt,[],`Imagens sem texto alternativo: ${missingImageAlt.join(', ')}`);
assert.deepEqual(unsafeBlankLinks,[],`Links em nova aba sem noopener: ${unsafeBlankLinks.join(', ')}`);
assert.deepEqual(invalidJson,[],`JSON inválido:\n${invalidJson.map(item=>`${item.file}: ${item.error}`).join('\n')}`);

console.log(`Integridade do site validada: ${htmlFiles.length} páginas, ${jsonFiles.length} arquivos JSON, estrutura acessível básica e referências internas sem quebra.`);
