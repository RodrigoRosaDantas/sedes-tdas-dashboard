import fs from 'node:fs/promises';

const parserFile='scripts/notion/daily-content.mjs';
const testFile='scripts/test-daily-content.mjs';

const parserBefore=`function parseAnswerKey(markdown) {
  const source = String(markdown ?? '').replace(/\\r/g, '');
  const start = source.search(/^#\\s+[^\\n]*Gabarito[^\\n]*$/im);
  if (start < 0) return new Map();
  const tail = source.slice(start);
  const next = tail.slice(1).search(/^#\\s+\\d+\\.[^\\n]*$/m);
  const section = next >= 0 ? tail.slice(0, next + 1) : tail;`;
const parserAfter=`function answerKeySection(source) {
  const headingStart = source.search(/^#{1,4}\\s+[^\\n]*Gabarito[^\\n]*$/im);
  if (headingStart >= 0) {
    const tail = source.slice(headingStart);
    const next = tail.slice(1).search(/^#\\s+\\d+\\.[^\\n]*$/m);
    return next >= 0 ? tail.slice(0, next + 1) : tail;
  }
  const header = source.search(/<tr>\\s*<td>\\s*Quest(?:ão|ao)\\s*<\\/td>\\s*<td>\\s*(?:Resposta|Gabarito)\\s*<\\/td>/i);
  if (header < 0) return '';
  const tableStart = source.lastIndexOf('<table', header);
  const tableEnd = source.indexOf('</table>', header);
  if (tableStart < 0 || tableEnd < 0) return '';
  return source.slice(tableStart, tableEnd + '</table>'.length);
}

function parseAnswerKey(markdown) {
  const source = String(markdown ?? '').replace(/\\r/g, '');
  const section = answerKeySection(source);
  if (!section) return new Map();`;

let parser=await fs.readFile(parserFile,'utf8');
if(!parser.includes('function answerKeySection(source)')){
 if(!parser.includes(parserBefore))throw new Error('Trecho esperado do gabarito não foi localizado.');
 parser=parser.replace(parserBefore,parserAfter);
 await fs.writeFile(parserFile,parser,'utf8');
}

const testMarker=`const html=renderMaterialMarkdown(`;
const regression=`const responseTableMarkdown = \`# 2. Questões
**1.** Primeira questão válida.
A) Correta
B) Incorreta
**2.** Segunda questão válida.
A) Incorreta
B) Correta
# 3. Resultado e fundamentos da correção
<table>
<tr><td>Questão</td><td>Resposta</td><td>Fundamento sintético</td></tr>
<tr><td>1</td><td>A</td><td>Fundamento da primeira.</td></tr>
<tr><td>2</td><td>B</td><td>Fundamento da segunda.</td></tr>
</table>
\`;
const {catalog:responseTableCatalog,key:responseTableKey}=parseDailyQuestions(responseTableMarkdown,{pe:'PE79',title:'Arquivologia',expectedCount:2,sourcePageId:'jkl'});
assert.equal(responseTableCatalog.questionCount,2);
assert.equal(responseTableKey.answers[0].gabarito,'A');
assert.equal(responseTableKey.answers[1].gabarito,'B');
assert.ok(!JSON.stringify(responseTableCatalog).includes('Fundamento da primeira'));

`;
let tests=await fs.readFile(testFile,'utf8');
if(!tests.includes('const responseTableMarkdown =')){
 if(!tests.includes(testMarker))throw new Error('Ponto de inserção do teste do gabarito não foi localizado.');
 tests=tests.replace(testMarker,`${regression}${testMarker}`);
 await fs.writeFile(testFile,tests,'utf8');
}

console.log('Leitura restrita da tabela de respostas e teste de regressão garantidos.');
