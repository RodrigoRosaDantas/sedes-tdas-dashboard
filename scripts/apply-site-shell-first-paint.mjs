import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=process.cwd();
const BOOT_VERSION='1.1.0';
const BOOT_HEAD=`<script data-site-theme-bootstrap>try{document.documentElement.dataset.theme=localStorage.getItem('tdas-theme')||'light'}catch{document.documentElement.dataset.theme='light'}setTimeout(()=>{if(document.documentElement.dataset.siteShell==='booting')document.documentElement.dataset.siteShell='fallback'},2500)</script>`;
const SHELL_ASSETS=`<link rel="stylesheet" href="/sedes-tdas-dashboard/assets/site-parity-v11.css?v=${BOOT_VERSION}" data-site-parity-v11="1"><link rel="stylesheet" href="/sedes-tdas-dashboard/assets/site-parity-v11-fixes.css?v=${BOOT_VERSION}" data-site-parity-v11-fixes="1"><link rel="stylesheet" href="/sedes-tdas-dashboard/assets/site-shell-boot.css?v=${BOOT_VERSION}" data-site-shell-boot="1"><link rel="modulepreload" href="/sedes-tdas-dashboard/assets/integration/site-parity-v11.js?v=${BOOT_VERSION}"><script type="module" src="/sedes-tdas-dashboard/assets/integration/site-parity-v11.js?v=${BOOT_VERSION}" data-site-shell-bootstrap="1"></script>`;

async function htmlFiles(directory=ROOT){
 const entries=await fs.readdir(directory,{withFileTypes:true});
 const files=[];
 for(const entry of entries){
  if(entry.name==='.git'||entry.name==='node_modules'||entry.name==='edas-administracao')continue;
  const target=path.join(directory,entry.name);
  if(entry.isDirectory())files.push(...await htmlFiles(target));
  else if(entry.name==='index.html')files.push(target);
 }
 return files;
}

function addHtmlContract(html){
 return html.replace(/<html\b([^>]*)>/i,(_,attributes)=>{
  let next=attributes
   .replace(/\sdata-site-parity=(['"])[^'"]*\1/gi,'')
   .replace(/\sdata-site-shell=(['"])[^'"]*\1/gi,'')
   .replace(/\sdata-theme=(['"])[^'"]*\1/gi,'');
  return `<html${next} data-site-parity="v11" data-site-shell="booting" data-theme="light">`;
 });
}

function applyContract(html,file){
 if(!html.includes('<div class="app">'))return html;
 if(html.includes('data-site-shell-bootstrap'))return html;
 let updated=addHtmlContract(html);
 if(!updated.includes('<head>'))throw new Error(`${file}: <head> ausente.`);
 if(!updated.includes('<title>'))throw new Error(`${file}: <title> ausente.`);
 updated=updated.replace('<head>',`<head>${BOOT_HEAD}`);
 updated=updated.replace('<title>',`${SHELL_ASSETS}<title>`);
 return updated;
}

let changed=0,covered=0;
for(const file of await htmlFiles()){
 const html=await fs.readFile(file,'utf8');
 if(!html.includes('<div class="app">'))continue;
 covered++;
 const updated=applyContract(html,path.relative(ROOT,file));
 if(updated!==html){await fs.writeFile(file,updated,'utf8');changed++}
}
console.log(`Shell no primeiro quadro aplicado: ${changed} arquivo(s) alterado(s), ${covered} rota(s) coberta(s), EDAS preservado.`);

export{applyContract};
