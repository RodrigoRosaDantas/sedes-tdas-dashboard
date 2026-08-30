import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const read=file=>fs.readFile(path.join(ROOT,file),'utf8');

async function collectHtml(directory=ROOT){
 const files=[];
 for(const entry of await fs.readdir(directory,{withFileTypes:true})){
  if(entry.name==='.git'||entry.name==='node_modules')continue;
  const target=path.join(directory,entry.name);
  if(entry.isDirectory())files.push(...await collectHtml(target));
  else if(entry.name==='index.html')files.push(target);
 }
 return files;
}

const[baseCss,fixes,shell,generator,platform,allHtml]=await Promise.all([
 read('assets/site-parity-v11.css'),
 read('assets/site-parity-v11-fixes.css'),
 read('assets/integration/site-parity-v11.js'),
 read('scripts/apply-site-shell-first-paint.mjs'),
 read('data/platform-version.json').then(JSON.parse),
 collectHtml()
]);

assert.match(baseCss,/\.pro26-utility-row\{display:none!important\}/,'Home deve eliminar a busca e a sincronização duplicadas abaixo do cabeçalho.');
assert.doesNotMatch(fixes,/\.pro26-utility-row\{display:grid!important\}/,'Correções responsivas não podem ressuscitar a utility row redundante.');
assert.match(fixes,/@media\(min-width:901px\) and \(max-width:1180px\)[\s\S]*?\.sidebar\{width:224px/,'iPad em paisagem deve usar sidebar compacta.');
assert.match(fixes,/@media\(max-width:900px\), \(orientation:portrait\) and \(min-width:781px\) and \(max-width:1024px\)/,'iPad em retrato deve compartilhar o shell móvel.');
assert.match(fixes,/\.mobile-nav\{position:fixed!important;[\s\S]*?bottom:max\(8px,env\(safe-area-inset-bottom\)\)!important/,'Navegação móvel deve permanecer no alcance do polegar e respeitar a safe area.');
assert.match(fixes,/\.mobile-nav a\{display:grid;min-width:96px;min-height:56px/,'Itens do dock móvel devem possuir alvo de toque amplo.');
assert.match(fixes,/scroll-snap-type:x proximity/,'Dock móvel deve rolar de forma previsível.');
assert.match(fixes,/\.btn\{min-height:44px;font-size:11px\}/,'Botões globais devem respeitar o alvo mínimo de toque.');
assert.match(fixes,/touch-action:manipulation/,'Controles devem responder ao toque sem atraso artificial.');

assert.match(shell,/aria-current="page"/,'Navegação deve identificar semanticamente a página ativa.');
assert.match(shell,/function centerMobileNav/,'Shell deve centralizar o item ativo no dock rolável.');
assert.match(shell,/nav\.scrollLeft=Math\.max/,'Centralização do dock deve ajustar sua posição horizontal.');
assert.match(shell,/addEventListener\('resize',\(\)=>centerMobileNav\(\)/,'Mudança de orientação deve recalcular o item ativo.');
assert.match(shell,/site-parity-v11-fixes\.css\?v=1\.2\.0/,'Fallback dinâmico deve carregar a revisão responsiva atual.');
assert.match(generator,/BOOT_VERSION='1\.2\.0'/,'Gerador deve preservar a revisão responsiva atual.');
assert.match(platform.serviceWorkerVersion,/cachefix6-pro13$/,'PWA deve invalidar a geração visual anterior.');

let tdas=0,edas=0;
for(const file of allHtml){
 const relative=path.relative(ROOT,file).replaceAll(path.sep,'/');
 const html=await fs.readFile(file,'utf8');
 if(relative.startsWith('edas-administracao/')){
  edas+=1;
  assert.doesNotMatch(html,/site-parity-v11|site-shell-boot/,`${relative}: EDAS deve permanecer isolado do shell TDAS.`);
  continue;
 }
 if(!html.includes('<div class="app">'))continue;
 tdas+=1;
 for(const asset of ['site-parity-v11.css','site-parity-v11-fixes.css','site-shell-boot.css','site-parity-v11.js']){
  assert.match(html,new RegExp(`${asset.replaceAll('.','\\.')}\\?v=1\\.2\\.0`),`${relative}: ${asset} está desatualizado.`);
 }
}
assert.ok(tdas>=150,`Cobertura responsiva insuficiente: ${tdas} rotas TDAS.`);
assert.ok(edas>0,'Cobertura EDAS ausente.');

console.log(`Contrato responsivo aprovado em ${tdas} rotas TDAS: mobile, iPad retrato/paisagem, desktop, safe area, acessibilidade e cache PRO13; ${edas} arquivos EDAS isolados.`);
