import fs from 'node:fs/promises';

const parserFile='scripts/notion/daily-content.mjs';
const testFile='scripts/test-daily-content.mjs';

const parserBefore=`function questionSegments(markdown) {
  const source = String(markdown ?? '').replace(/\\r/g, '');
  const matches = [...source.matchAll(/^(?:##\\s+Quest(?:ão|ao)\\s+(\\d+)\\s*|\\*\\*(\\d{1,3})\\.\\*\\*\\s*(.*))$/gim)];`;
const parserAfter=`function questionSection(markdown) {
  const source = String(markdown ?? '').replace(/\\r/g, '');
  const heading = source.match(/^#\\s+[^\\n]*Quest(?:ões|oes)[^\\n]*$/im);
  if (!heading) return source;
  const tail = source.slice(heading.index + heading[0].length);
  const nextHeading = tail.search(/^#\\s+[^\\n]+$/m);
  return nextHeading >= 0 ? tail.slice(0, nextHeading) : tail;
}

function questionSegments(markdown) {
  const source = questionSection(markdown);
  const matches = [...source.matchAll(/^(?:##\\s+Quest(?:ão|ao)\\s+(\\d+)\\s*|\\*\\*(\\d{1,3})\\.\\*\\*\\s*(.*))$/gim)];`;

let parser=await fs.readFile(parserFile,'utf8');
if(!parser.includes(parserBefore))throw new Error('Trecho esperado do parser não foi localizado.');
parser=parser.replace(parserBefore,parserAfter);
await fs.writeFile(parserFile,parser,'utf8');

const testMarker=`const html=renderMaterialMarkdown(`;
const regression=`const postResultMarkdown = \`# 2. Questões
**1.** Primeira questão válida do bloco.
A) Correta
B) Incorreta
**2.** Segunda questão válida do bloco.
A) Incorreta
B) Correta
# 3. Resultado e relatório pós-prova
**1.** Erro por interpretação registrado após a finalização.
A) Este item pertence ao relatório, não ao bloco de questões.
B) Este item também não deve ser importado.
**2.** Ponto de revisão do estudante.
A) Relatório posterior.
B) Relatório posterior.
**3.** Próxima providência de estudo.
A) Relatório posterior.
B) Relatório posterior.
# 4. Gabarito
1-A | 2-B
\`;
const {catalog:postResultCatalog,key:postResultKey}=parseDailyQuestions(postResultMarkdown,{pe:'PE79',title:'Arquivologia',expectedCount:2,sourcePageId:'ghi'});
assert.equal(postResultCatalog.questionCount,2);
assert.deepEqual(postResultCatalog.questions.map(item=>item.numeroOriginal),[1,2]);
assert.equal(postResultKey.answers[0].gabarito,'A');
assert.equal(postResultKey.answers[1].gabarito,'B');
assert.ok(!JSON.stringify(postResultCatalog).includes('Erro por interpretação'));

`;
let tests=await fs.readFile(testFile,'utf8');
if(!tests.includes(testMarker))throw new Error('Ponto de inserção do teste não foi localizado.');
tests=tests.replace(testMarker,`${regression}${testMarker}`);
await fs.writeFile(testFile,tests,'utf8');

console.log('Parser limitado à seção oficial de questões e teste de regressão incluído.');
