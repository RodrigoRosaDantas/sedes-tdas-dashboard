import fs from 'node:fs';

const sheet=JSON.parse(fs.readFileSync('data/candidate-answer-sheet.json','utf8'));
const schedule=JSON.parse(fs.readFileSync('data/post-exam-official-schedule.json','utf8'));
const home=fs.readFileSync('assets/integration/post-exam-home.js','utf8');
const scheduleRuntime=fs.readFileSync('assets/integration/post-exam-official-schedule.js','utf8');
const index=fs.readFileSync('index.html','utf8');

const fail=message=>{throw new Error(`Gabarito do candidato: ${message}`)};
const responses=sheet?.candidate?.responses||[];

if(sheet?.meta?.contest!=='SEDES/DF 2026')fail('concurso incorreto.');
if(sheet?.meta?.role!=='Técnico Administrativo'||String(sheet?.meta?.cargo)!=='202')fail('cargo incorreto.');
if(sheet?.meta?.examDate!=='2026-09-06')fail('data da prova incorreta.');
if(responses.length!==60)fail(`esperadas 60 respostas; recebidas ${responses.length}.`);

const questions=responses.map(item=>Number(item.question));
if(new Set(questions).size!==60||questions.some((question,index)=>question!==index+1))fail('questões devem cobrir 1–60 sem duplicidade.');

const singles=responses.filter(item=>item.cardStatus==='single');
const multiples=responses.filter(item=>item.cardStatus==='multiple');
if(singles.length!==59)fail(`esperadas 59 marcações simples; recebidas ${singles.length}.`);
if(multiples.length!==1||Number(multiples[0].question)!==30)fail('Q30 deve ser a única dupla marcação.');
if(sheet?.candidate?.singleMarked!==59||sheet?.candidate?.multipleMarked!==1||sheet?.candidate?.blank!==0)fail('resumo de marcações inconsistente.');

const q8=responses.find(item=>Number(item.question)===8);
const q30=responses.find(item=>Number(item.question)===30);
if(q8?.notebook!=='B'||q8?.cardAnswer!=='B'||q8?.cardStatus!=='single')fail('Q8 deve estar registrada como B.');
if(q30?.notebook!=='D'||q30?.cardStatus!=='multiple'||q30?.cardAnswer!==null)fail('Q30 deve preservar D no caderno e dupla marcação no cartão, sem resposta única.');

const preliminary=sheet?.official?.preliminary||{};
if(preliminary.status!=='not_published'||(preliminary.answers||[]).length!==0)fail('não pode haver gabarito preliminar inventado.');
if(sheet?.comparison?.status!=='pending_preliminary_key')fail('comparação deve permanecer pendente até publicação oficial.');

const preliminarySchedule=schedule?.milestones?.preliminaryKey||{};
if(preliminarySchedule.date!=='2026-09-09'||preliminarySchedule.status!=='scheduled')fail('data oficial do gabarito preliminar deve ser 09/09/2026.');
if(schedule?.source?.organization!=='Instituto Quadrix'||schedule?.source?.url!=='https://quadrix.org.br/informacoes/3056/')fail('cronograma deve apontar para a fonte oficial da Quadrix.');

for(const token of [
 'data/candidate-answer-sheet.json',
 'MEU GABARITO · PROVA REAL',
 'Aguardando gabarito preliminar',
 'Q8 confirmada: B',
 'Q30: dupla marcação',
 'buildCandidateComparison'
])if(!home.includes(token))fail(`Home não contém o contrato ${token}.`);

if(!home.includes("preliminary.status==='published'")||!home.includes('officialByQuestion'))fail('Home não está preparada para o cruzamento futuro com o preliminar.');
for(const token of ['data/post-exam-official-schedule.json','Divulgação prevista:','preliminaryDate'])if(!scheduleRuntime.includes(token))fail(`Runtime do cronograma não contém ${token}.`);
if(!index.includes('post-exam-official-schedule.js?v=1.0.0'))fail('Home não carrega o cronograma oficial.');

console.log('Gabarito real validado: 60 questões, 59 simples, Q8=B, Q30 dupla; preliminar ainda não publicado e divulgação oficial prevista para 09/09/2026.');
