import fs from 'node:fs/promises';

const read = file => fs.readFile(file, 'utf8');
const required = (condition, message) => { if (!condition) throw new Error(message); };
const [core, ui, attempts, performance, html, packageText] = await Promise.all([
  read('assets/integration/backup-migration-core.js'),
  read('assets/integration/backup-migration-ui.js'),
  read('assets/integration/attempt-store.js'),
  read('assets/integration/performance-metrics.js'),
  read('mais/index.html'),
  read('package.json'),
]);

for (const name of ['createStudyBackup','validateStudyBackup','restoreStudyBackup','previewLegacyMigration','applyLegacyMigration']) {
  required(core.includes(`function ${name}`) || core.includes(`function ${name}(`) || core.includes(`export async function ${name}`) || core.includes(`export function ${name}`), `Operação ausente: ${name}.`);
}
required(core.includes("digest('SHA-256'"), 'Backup não usa checksum SHA-256.');
required(core.includes("scope: 'rodrigo-202-local'"), 'Escopo do backup não está fixado.');
required(core.includes("cargo-not-202") && core.includes("profile-not-rodrigo"), 'Filtros de perfil e cargo ausentes.');
required(core.includes("question-result-incomplete") && core.includes("pe-missing-or-invalid"), 'Registros incompletos não são bloqueados.');
required(core.includes("destructive: false"), 'Plano não declara migração não destrutiva.');
required(core.includes("sourceSystem: 'sedes-df-questoes'"), 'Procedência legada ausente.');
required(core.includes('Restauração revertida') && core.includes('Migração revertida'), 'Rollback não está explícito.');
required(!/fetch\s*\(|notion\.com|api\.notion/i.test(core), 'Núcleo de backup não pode acessar rede ou Notion.');
required(!/removeItem\(plan\.sourceKey|removeItem\(LEGACY_KEYS\.history/.test(core), 'Fonte legada não pode ser apagada.');

required(attempts.includes("ATTEMPT_MODES = Object.freeze(['pilot', 'review', 'legacy'])"), 'Modo legado não foi isolado no histórico.');
required(attempts.includes("attempt.mode === 'legacy'") && attempts.includes("attempt.pilot !== false"), 'Validação da tentativa legada ausente.');
required(attempts.includes("sourceSystem !== 'sedes-df-questoes'"), 'Histórico não exige procedência legada.');
required(performance.includes("legacyAttempts"), 'Painel não contabiliza tentativas legadas separadamente.');
required(performance.includes("scope: 'local-study'"), 'Painel não ampliou o escopo local de forma explícita.');

for (const marker of ['data-backup-export','data-backup-import','data-migration-preview','data-migration-apply']) {
  required(ui.includes(marker), `Controle de interface ausente: ${marker}.`);
}
required(ui.indexOf('createStudyBackup()') < ui.indexOf('applyLegacyMigration('), 'Migração não cria backup antes da aplicação.');
required(ui.includes('{includeLegacy: false}'), 'Restauração padrão deve preservar as chaves legadas atuais.');
required(ui.includes('applyButton.disabled = migrationPlan.compatible.length === 0'), 'Migração sem registros compatíveis não está bloqueada.');
required(!/fetch\s*\(|notion\.com|api\.notion/i.test(ui), 'Interface não pode acessar rede ou Notion.');
required(html.includes('/assets/integration/backup-migration-ui.js'), 'Página Mais não carrega a interface da Fase 10.');
required(packageText.includes('check:backup') && packageText.includes('test:backup'), 'Comandos de backup ausentes do package.json.');

console.log('Backup e migração validados: checksum, opt-in, filtros, procedência, rollback e preservação da fonte antiga.');
