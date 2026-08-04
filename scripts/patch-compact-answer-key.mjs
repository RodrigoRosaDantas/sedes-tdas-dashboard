import fs from 'node:fs/promises';

const parserFile='scripts/notion/daily-content.mjs';
const testFile='scripts/test-daily-content.mjs';

const sectionNeedle=`  const headingStart = source.search(/^#{1,4}\\s+[^\\n]*Gabarito[^\\n]*$/im);
  if (headingStart >= 0) {
    const tail = source.slice(headingStart);
    const next = tail.slice(1).search(/^#\\s+\\d+\\.[^\\n]*$/m);
    return next >= 0 ? tail.slice(0, next + 1) : tail;
  }`;
const sectionReplacement=`  const heading = source.match(/^#{1,4}\\s+[^\\n]*Gabarito[^\\n]*$/im);
  if (heading?.index >= 0) {
    const tail = source.slice(heading.index + heading[0].length).replace(/^\\n/, '');
    const next = tail.search(/^#\\s+\\d+\\.[^\\n]*$/m);
    return next >= 0 ? tail.slice(0, next) : tail;
  }`;
const parserNeedle=`  if (section) {
    for (const match of section.matchAll(/\\b(\\d{1,3})\\s*[-–—]\\s*([A-E])\\b/g)) add(Number(match[1]), match[2]);
  }
  const tableSource = section || source;`;
const parserReplacement=`  if (section) {
    for (const match of section.matchAll(/\\b(\\d{1,3})\\s*[-–—]\\s*([A-E])\\b/g)) add(Number(match[1]), match[2]);
    for (const match of section.matchAll(/(?:^|[,;\\s])(\\d{1,3})\\s*([A-E])(?=\\s*(?:[,;.]|$))/gmi)) add(Number(match[1]), match[2].toUpperCase());
  }
  const tableSource = section || source;`;

let parser=await fs.readFile(parserFile,'utf8');
if(!parser.includes('const heading = source.match')){
 if(!parser.includes(sectionNeedle))throw new Error('Recorte do título de gabarito não localizado.');
 parser=parser.replace(sectionNeedle,sectionReplacement);
}
if(!parser.includes('(?:^|[,;\\s])(\\d{1,3})')){
 if(!parser.includes(parserNeedle))throw new Error('Ponto do parser compacto não localizado.');
 parser=parser.replace(parserNeedle,parserReplacement);
}
await fs.writeFile(parserFile,parser,'utf8');

const marker=`const html=renderMaterialMarkdown(`;
const regression=`const compactKeyMarkdown = \`# 2. Questões
**1.** Primeira questão válida.
A) Correta
B) Incorreta
**2.** Segunda questão válida.
A) Incorreta
B) Correta
## 3.2 Gabarito definitivo
1A, 2B.
# 4. Correção detalhada dos erros reais
## Questão 1 — Exemplo posterior
**Resposta marcada:** B
**Gabarito:** A
\`;
const {catalog:compactKeyCatalog,key:compactKey}=parseDailyQuestions(compactKeyMarkdown,{pe:'PE79',title:'Arquivologia',expectedCount:2,sourcePageId:'stu'});
assert.equal(compactKeyCatalog.questionCount,2);
assert.equal(compactKey.answers.length,2);
assert.equal(compactKey.answers[0].gabarito,'A');
assert.equal(compactKey.answers[1].gabarito,'B');
assert.ok(!JSON.stringify(compactKeyCatalog).includes('Gabarito definitivo'));

`;
let tests=await fs.readFile(testFile,'utf8');
if(!tests.includes('const compactKeyMarkdown =')){
 if(!tests.includes(marker))throw new Error('Ponto de inserção do teste compacto não localizado.');
 tests=tests.replace(marker,`${regression}${marker}`);
 await fs.writeFile(testFile,tests,'utf8');
}

console.log('Recorte do título e gabarito compacto reconhecidos com teste de regressão.');
