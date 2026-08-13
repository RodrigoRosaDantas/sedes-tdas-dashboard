import {BASE} from '../common.js?v=26.17.0';

const main=document.querySelector('main');
if(main){
 main.innerHTML=`<section class="hero"><span class="kicker">Armazenamento local</span><h1>Sincronização entre dispositivos desativada</h1><p>O TDAS não utiliza armazenamento remoto nesta versão. Seu progresso permanece somente neste navegador e o Notion continua como fonte oficial do planejamento e conteúdo.</p><div class="hero-actions"><a class="btn primary" href="${BASE}">Voltar à Home</a><a class="btn" href="${BASE}dados-locais/">Backup dos dados locais</a></div></section>`;
}
