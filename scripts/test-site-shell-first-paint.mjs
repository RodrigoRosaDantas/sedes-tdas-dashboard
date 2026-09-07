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
 assert.match(html,/^<!doctype html>(?:\s*)<html\b[^>]*data-site-parity="v11"[^>]*data-site-shell="booting"[^>]*data-theme="light"/i,`${relative}: contrato inicial ausente.`);
 assert.ok(theme>0&&theme<firstStyle,`${relative}: tema deve ser resolvido antes do primeiro CSS.`);
 for(const[index,label]of[[parityCss,'CSS de paridade'],[fixesCss,'correções de paridade'],[bootCss,'CSS de boot'],[bootstrap,'bootstrap do shell']])assert.ok(index>0&&index<headEnd,`${relative}: ${label} deve estar no head.`);
 assert.ok(parityCss<fixesCss&&fixesCss<bootCss&&bootCss<bootstrap,`${relative}: ordem de carregamento do shell inválida.`);
 assert.equal((html.match(/data-site-shell-bootstrap=/g)||[]).length,1,`${relative}: bootstrap duplicado.`);
}
for(const[relative,html]of edas){
 assert.doesNotMatch(html,/data-site-shell-bootstrap|data-site-shell="booting"/,`${relative}: shell TDAS não pode contaminar o EDAS.`);
}
const[parity,postExamShell,common,mobileUx,boot,sw,postprocess,preserve,versionSync]=await Promise.all([
 fs.readFile('assets/integration/site-parity-v11.js','utf8'),fs.readFile('assets/integration/post-exam-shell.js','utf8'),fs.readFile('assets/common.js','utf8'),fs.readFile('assets/tdas-mobile-ux.js','utf8'),fs.readFile('assets/site-shell-boot.css','utf8'),fs.readFile('sw.js','utf8'),fs.readFile('scripts/postprocess-v26.mjs','utf8'),fs.readFile('scripts/preserve-v27-pwa.mjs','utf8'),fs.readFile('scripts/sync-platform-version.mjs','utf8')
]);
assert.match(parity,/dataset\.siteShell='ready'/,'Shell deve liberar a interface após a reconstrução síncrona.');
assert.match(parity,/label:'Pós-prova',hint:'Agora'/,'Fonte do shell deve nascer em modo pós-prova.');
assert.match(parity,/label:'Histórico',hint:'Ciclo'/,'Histórico deve ser destino principal depois da prova.');
assert.match(parity,/label:'Arquivo do ciclo',hint:'PEs e materiais'/,'Ferramentas antigas devem ser agrupadas como arquivo do ciclo.');
assert.doesNotMatch(parity,/\{id:'execute',label:'Resolver questões'/,'Resolvedor não pode ocupar a navegação principal pós-prova.');
assert.doesNotMatch(parity,/\{id:'reviews',label:'Revisões'/,'Revisões não podem ocupar a navegação principal pós-prova.');
assert.doesNotMatch(parity,/label:'Faça agora'/,'Fonte do shell não pode reconstruir a Home como Faça agora.');
assert.doesNotMatch(parity,/function examState\(/,'Contagem regressiva pré-prova não pode permanecer no shell base.');
assert.match(parity,/Prova realizada<\/span><b>Concluído<\/b>/,'Card da prova deve nascer encerrado, sem depender de correção posterior no DOM.');
assert.match(postExamShell,/observer\.disconnect\(\)/,'Fallback pós-prova precisa encerrar o MutationObserver quando o shell estiver pronto.');
assert.match(postExamShell,/setTimeout\(\(\)=>observer\.disconnect\(\),5000\)/,'Fallback pós-prova não pode observar o DOM indefinidamente.');
assert.match(common,/siteParityActive/,'setupShell deve preservar o shell já inicializado.');
assert.match(mobileUx,/siteParityActive.*if\(!siteParityActive\)\{renderHeader\(\);renderBottomNav\(\);augmentDesktop\(\)\}/,'UX mobile legada não pode sobrescrever um shell já pronto.');
assert.match(boot,/data-site-shell="booting"/,'CSS deve possuir estado de carregamento explícito.');
for(const source of[sw,postprocess,preserve])assert.ok(source.includes('assets/site-shell-boot.css'),'PWA deve preservar o CSS do primeiro quadro.');
assert.match(sw,/const postExamRuntime=.*site-parity-v11\.js.*post-exam-shell\.js.*post-exam-home\.js/,'Service worker deve tratar o runtime pós-prova separadamente.');
assert.match(sw,/postExamRuntime\)\{event\.respondWith\(fetchAndCache\(event\.request,\{fresh:true\}\)/,'Runtime pós-prova deve priorizar rede fresca com fallback offline.');
assert.match(preserve,/function preservePostExamRuntime\(/,'Preservador deve reconstruir a proteção de cache após cada sincronização.');
assert.match(versionSync,/VISUAL_CACHE_REV='cachefix7-postexam-pro12'/,'Revisão visual precisa invalidar o cache pré-prova já instalado.');
console.log(`Primeiro quadro pós-prova validado em ${tdas.length} rotas TDAS; navegação principal enxuta e ${edas.length} arquivos EDAS permaneceram isolados.`);
