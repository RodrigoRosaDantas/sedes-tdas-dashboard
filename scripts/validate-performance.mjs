import fs from 'node:fs/promises';

const read = file => fs.readFile(file, 'utf8');
const required = (condition, message) => { if (!condition) throw new Error(message); };
const [metrics, page, html, packageText] = await Promise.all([
  read('assets/integration/performance-metrics.js'),
  read('assets/integration/performance.js'),
  read('desempenho/index.html'),
  read('package.json'),
]);

required(metrics.includes('buildPerformanceSnapshot'), 'Agregador principal ausente.');
for (const field of ['pilotAttempts','reviewAttempts','averageQuestionMs','bestPilotPercent','classifications','confidence','subjects','reviews','trend']) {
  required(metrics.includes(field), `Métrica ausente: ${field}.`);
}
for (const classification of ['incorrect_confirmed','correct_secure','correct_with_doubt','correct_by_guess','marked','annulment_pending','source_error']) {
  required(metrics.includes(`'${classification}'`), `Classificação ausente do painel: ${classification}.`);
}
for (const confidence of ['secure','doubt','guess']) required(metrics.includes(`'${confidence}'`), `Confiança ausente: ${confidence}.`);
required(metrics.includes("scope: 'pilot-local'"), 'Escopo do painel não está fixado como local.');
required(metrics.includes('sort((a, b) => a.accuracy - b.accuracy'), 'Assuntos não são priorizados pelo menor aproveitamento.');
required(metrics.includes('ordered.slice(-20)'), 'Tendência não limita os últimos vinte registros.');
required(!/localStorage|sessionStorage|indexedDB|fetch\s*\(|notion\.com|api\.notion/i.test(metrics), 'Agregador não pode acessar armazenamento, rede ou Notion.');

for (const importName of ['readAttempts','readReviews','readPeProgress','buildPerformanceSnapshot']) required(page.includes(importName), `Página não usa ${importName}.`);
required(!/setItem|removeItem|saveAttempt|recordAttemptPeProgress|scheduleAttemptReviews|completeReview/.test(page), 'Painel de desempenho não pode escrever dados.');
required(!/notion\.com|api\.notion/i.test(page), 'Painel não pode acessar o Notion.');
required(page.includes('Este painel não substitui a Evolução oficial'), 'Separação do painel oficial não está declarada.');
required(page.includes(`${'${BASE}'}evolucao/`), 'Atalho para a evolução oficial ausente.');
required(html.includes('/assets/integration/performance.js'), 'Rota Desempenho não carrega o painel funcional.');
required(!html.includes('/assets/integration/navigation.js'), 'Rota Desempenho ainda carrega a estrutura antiga.');
required(packageText.includes('check:performance') && packageText.includes('test:performance'), 'Comandos de desempenho ausentes.');

console.log('Desempenho validado: métricas derivadas em leitura, confiança, assuntos, tendência, revisões e separação oficial.');
