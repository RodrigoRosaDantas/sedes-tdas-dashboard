import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [html,script,css,verticalized,pwa]=await Promise.all([
 fs.readFile('edital/index.html','utf8'),
 fs.readFile('assets/edital-simple.js','utf8'),
 fs.readFile('assets/edital-simple.css','utf8'),
 fs.readFile('assets/edital-verticalized-access.js','utf8'),
 fs.readFile('scripts/preserve-v27-pwa.mjs','utf8')
]);

assert.match(html,/assets\/edital-simple\.css\?v=1\.0\.0/,'Edital não carrega a camada visual simplificada.');
assert.match(html,/assets\/edital-simple\.js\?v=1\.0\.0/,'Edital não carrega o controlador de hierarquia simplificada.');
assert.match(html,/assets\/edital-verticalized-access\.js\?v=1\.0\.0/,'Edital não carrega o acesso explícito ao verticalizado.');
assert.ok(html.indexOf('edital-diagnostic.js')<html.indexOf('edital-simple.js'),'Simplificação deve rodar depois da fila diagnóstica.');
for(const marker of['Seu edital, sem bagunça','edital-metric-secondary','edital-catalog-details','edital-secondary','edital-diagnostic-more','Filtros avançados','Consultar todos os tópicos','Ver próxima ação','edital-proxima-acao'])assert.ok(script.includes(marker),`UX simplificada perdeu o marcador ${marker}.`);
for(const marker of['Edital verticalizado','Abrir edital verticalizado','busca, filtros e situação por assunto','data-edital-next-action','verticalizedAction'])assert.ok(verticalized.includes(marker),`Acesso ao edital verticalizado perdeu o marcador ${marker}.`);
assert.match(verticalized,/primary\.href='#topicos'/,'CTA principal deve apontar diretamente para o catálogo verticalizado.');
assert.match(verticalized,/details\.open=true/,'CTA do verticalizado deve abrir o catálogo recolhido.');
assert.match(script,/heroActions\.slice\(1\)/,'Ações secundárias do hero não foram retiradas da superfície principal.');
assert.match(script,/summaryItems\.forEach/,'Resumo diagnóstico deve ser integralmente movido para a fila expandida.');
assert.match(script,/cards\.slice\(1\)/,'Fila diagnóstica ainda deve manter apenas a primeira prioridade na superfície.');
assert.match(script,/\.btn:not\(\.primary\)/,'A ação secundária da prioridade atual deve sair da superfície principal.');
assert.doesNotMatch(script,/class=["']skip["']/,'Camada simplificada não deve reutilizar a classe global de skip-link em conteúdo não focável.');
assert.match(css,/\.edital-metric-secondary\{display:none\}/,'Apenas três métricas essenciais devem permanecer na superfície principal.');
assert.match(css,/nth-child\(5\).*display:none/s,'Tabela simplificada não oculta colunas redundantes.');
assert.match(css,/edital-catalog-details/,'Checklist completo deixou de usar divulgação progressiva.');
assert.match(css,/edital-secondary/,'Explicações e disciplinas deixaram de ser conteúdo secundário recolhível.');
assert.match(css,/edital-diagnostic-more-actions/,'Ações secundárias da fila precisam permanecer acessíveis dentro da expansão.');
assert.ok(!script.includes('api.notion.com')&&!verticalized.includes('api.notion.com'),'Camadas de UX não podem consultar a API do Notion diretamente.');
for(const asset of['assets/edital-simple.js','assets/edital-simple.css','assets/edital-verticalized-access.js'])assert.ok(pwa.includes(asset),`PWA pode perder ${asset} após sincronização.`);

console.log('UX do Edital validada: verticalizado explícito no topo, 3 métricas essenciais, próxima ação separada, fila progressiva e detalhes preservados.');