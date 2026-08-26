import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
async function collect(directory=ROOT){
 const files=[];
 for(const entry of await fs.readdir(directory,{withFileTypes:true})){
  if(entry.name==='.git'||entry.name==='node_modules')continue;
  const target=path.join(directory,entry.name);
  if(entry.isDirectory())files.push(...await collect(target));
  else if(entry.name==='index.html')files.push(target);
 }
 return files;
}

const all=await collect();
const tdas=[],edas=[];
for(const file of all){
 const relative=path.relative(ROOT,file).replaceAll(path.sep,'/');
 const html=await fs.readFile(file,'utf8');
 if(relative.startsWith('edas-administracao/')){edas.push([relative,html]);continue}
 if(html.includes('<div class="app">'))tdas.push([relative,html]);
}
assert.ok(tdas.length>=150,`Cobertura inesperada do shell TDAS: ${tdas.length} rotas.`);
for(const[relative,html]of tdas){
 const headEnd=html.indexOf('</head>');
 const firstStyle=html.indexOf('<link rel="stylesheet"');
 const theme=html.indexOf('data-site-theme-bootstrap');
 const parityCss=html.indexOf('data-site-parity-v11="1"');
 const fixesCss=html.indexOf('data-site-parity-v11-fixes="1"');
 const bootCss=html.indexOf('data-site-shell-boot="1"');
 const bootstrap=html.indexOf('data-site-shell-bootstrap="1"');
 assert.match(html,/^<!doctype html><html\b[^>]*data-site-parity="v11"[^>]*data-site-shell="booting"[^>]*data-theme="light"/i,`${relative}: contrato inicial ausente.`);
 assert.ok(theme>0&&theme<firstStyle,`${relative}: tema deve ser resolvido antes do primeiro CSS.`);
 for(const[index,label]of[[parityCss,'CSS de paridade'],[fixesCss,'correções de paridade'],[bootCss,'CSS de boot'],[bootstrap,'bootstrap do shell']])assert.ok(index>0&&index<headEnd,`${relative}: ${label} deve estar no head.`);
 assert.ok(parityCss<fixesCss&&fixesCss<bootCss&&bootCss<bootstrap,`${relative}: ordem de carregamento do shell inválida.`);
 assert.equal((html.match(/data-site-shell-bootstrap=/g)||[]).length,1,`${relative}: bootstrap duplicado.`);
}
assert.ok(edas.length>0,'Fixture EDAS ausente.');
for(const[relative,html]of edas){
 assert.doesNotMatch(html,/data-site-shell-bootstrap|data-site-shell="booting"/,`${relative}: shell TDAS não pode contaminar o EDAS.`);
}
const[parity,common,boot,sw,postprocess,preserve]=await Promise.all([
 fs.readFile('assets/integration/site-parity-v11.js','utf8'),fs.readFile('assets/common.js','utf8'),fs.readFile('assets/site-shell-boot.css','utf8'),fs.readFile('sw.js','utf8'),fs.readFile('scripts/postprocess-v26.mjs','utf8'),fs.readFile('scripts/preserve-v27-pwa.mjs','utf8')
]);
assert.match(parity,/dataset\.siteShell='ready'/,'Shell deve liberar a interface após a reconstrução síncrona.');
assert.match(common,/siteParityActive/,'setupShell deve preservar o shell já inicializado.');
assert.match(boot,/data-site-shell="booting"/,'CSS deve possuir estado de carregamento explícito.');
for(const source of[sw,postprocess,preserve])assert.ok(source.includes('assets/site-shell-boot.css'),'PWA deve preservar o CSS do primeiro quadro.');
console.log(`Primeiro quadro validado em ${tdas.length} rotas TDAS; ${edas.length} arquivos EDAS permaneceram isolados.`);
