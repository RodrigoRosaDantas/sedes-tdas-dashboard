import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/notion-sync.yml', 'utf8');
const stepStart = workflow.indexOf('- name: Consultar, gerar e validar fora do main');
const stepEnd = workflow.indexOf('\n      - name: Criar conjunto integral validado', stepStart);
assert.ok(stepStart >= 0 && stepEnd > stepStart, 'Etapa principal da sincronização não encontrada.');

const syncStep = workflow.slice(stepStart, stepEnd);
const disableErrexit = syncStep.indexOf('set +e');
const firstPipeline = syncStep.indexOf('node scripts/prepare-calendar-refresh.mjs');
assert.ok(disableErrexit >= 0, 'A etapa deve desativar errexit para capturar o código de falha.');
assert.ok(disableErrexit < firstPipeline, 'Errexit deve ser desativado antes da primeira validação.');
assert.match(syncStep, /sync_status=\$\{PIPESTATUS\[0\]\}/, 'O código real da pipeline deve ser capturado.');
assert.match(
  syncStep,
  /if \[\[ \$sync_status -ne 0 \]\]; then[\s\S]*set -e[\s\S]*record-sync-error\.mjs[\s\S]*sync-errors\/run-/,
  'A falha deve reativar modo estrito, registrar histórico e publicar uma branch de erro.'
);

const prioritiesTest = fs.readFileSync('scripts/test-daily-priorities.mjs', 'utf8');
assert.doesNotMatch(
  prioritiesTest,
  /assert\.equal\(\s*today\.current\.pe\s*,\s*['"]PE\d+['"]\s*\)/,
  'Testes sobre o snapshot vigente não podem ficar presos a um PE literal.'
);

console.log('Guardas operacionais validadas: falhas são registradas e o PE vigente não fica fixado em teste.');
