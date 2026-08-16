import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [html,script,css,pwa]=await Promise.all([
 fs.readFile('edital/index.html','utf8'),
 fs.readFile('assets/edital-simple.js','utf8'),
 fs.readFile('assets/edital-simple.css','utf8'),
 fs.readFile('scripts/preserve-v27-pwa.mjs','utf8')
]);

assert.match(html,/assets\/edital-simple\.css\?v=1\.0\.0/,'Edital não carrega a camada visual simplificada.');
assert.match(html,/assets\/edital-simple\.js\?v=1\.0\.0/,'Edital não carrega o controlador de hierarquia simplificada.');
assert.ok(html.indexOf('edital-diagnostic.js')<html.indexOf('edital-simple.js'),'Simplificação deve rodar depois da fila diagnóstica.');
for(const marker of['Seu edital, sem bagunça','edital-metric-secondary','edital-catalog-details','edital-secondary','edital-diagnostic-more','Filtros avançados','Consultar todos os tópicos'])assert.ok(script.includes(marker),`UX simplificada perdeu o marcador ${marker}.`);
assert.match(script,/heroActions\.slice\(1\)/,'Ações secundárias do hero não foram retiradas da superfície principal.');
assert.match(script,/summaryItems\.slice\(1\)/,'Resumo diagnóstico ainda expõe todos os indicadores de uma vez.');
assert.match(script,/cards\.slice\(1\)/,'Fila diagnóstica ainda expõe todas as prioridades de uma vez.');
assert.match(css,/\.edital-metric-secondary\{display:none\}/,'Apenas três métricas essenciais devem permanecer na superfície principal.');
assert.match(css,/nth-child\(5\).*display:none/s,'Tabela simplificada não oculta colunas redundantes.');
assert.match(css,/edital-catalog-details/,'Checklist completo deixou de usar divulgação progressiva.');
assert.match(css,/edital-secondary/,'Explicações e disciplinas deixaram de ser conteúdo secundário recolhível.');
assert.ok(!script.includes('api.notion.com'),'Camada de UX não pode consultar a API do Notion diretamente.');
for(const asset of['assets/edital-simple.js','assets/edital-simple.css'])assert.ok(pwa.includes(asset),`PWA pode perder ${asset} após sincronização.`);

console.log('UX do Edital validada: 3 métricas essenciais, uma próxima ação, fila progressiva, filtros recolhíveis, checklist simplificado e detalhes secundários preservados.');
