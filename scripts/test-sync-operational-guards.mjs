import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/notion-sync.yml', 'utf8');
const cycleStart = workflow.indexOf('- name: Verificar janela do ciclo');
const branchStart = workflow.indexOf('\n      - name: Preparar branch isolada', cycleStart);
assert.ok(cycleStart >= 0 && branchStart > cycleStart, 'Etapa de definição do ciclo não encontrada.');
const cycleStep = workflow.slice(cycleStart, branchStart);
assert.match(cycleStep, /reference_now=.*date --iso-8601=seconds/, 'A sincronização deve fixar o instante de referência no início da execução.');
assert.match(cycleStep, /reference_now=\$reference_now.*GITHUB_OUTPUT/, 'O instante fixo precisa ser publicado como output do ciclo.');

const stepStart = workflow.indexOf('- name: Consultar, gerar e validar fora do main');
const stepEnd = workflow.indexOf('\n      - name: Criar conjunto integral validado', stepStart);
assert.ok(stepStart >= 0 && stepEnd > stepStart, 'Etapa principal da sincronização não encontrada.');

const syncStep = workflow.slice(stepStart, stepEnd);
assert.ok(syncStep.includes('NOW: ${{ steps.cycle.outputs.reference_now }}'), 'Preparação e validação precisam compartilhar o mesmo instante de referência, inclusive após a meia-noite.');
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

assert.match(workflow,/permissions:[\s\S]*contents: write[\s\S]*pages: write/,'O sync precisa de permissão explícita para solicitar rebuild do GitHub Pages.');
const publishStart=workflow.indexOf('- name: Criar conjunto integral validado');
const promoteStart=workflow.indexOf('\n      - name: Promover atomicamente para main',publishStart);
const pagesStart=workflow.indexOf('\n      - name: Solicitar build do GitHub Pages da revisão sincronizada',promoteStart);
assert.ok(publishStart>=0&&promoteStart>publishStart&&pagesStart>promoteStart,'Publicação deve gerar snapshot, promover main e só então solicitar o Pages.');
const publishStep=workflow.slice(publishStart,promoteStart);
assert.match(publishStep,/id: publish/,'Etapa de publicação precisa expor se houve mudança.');
assert.match(publishStep,/changed=false.*GITHUB_OUTPUT/s,'Sync sem alteração precisa sinalizar que não há rebuild necessário.');
assert.match(publishStep,/changed=true.*GITHUB_OUTPUT/s,'Sync com alteração precisa sinalizar rebuild necessário.');
const pagesStep=workflow.slice(pagesStart);
assert.match(pagesStep,/steps\.publish\.outputs\.changed == 'true'/,'Pages só deve ser solicitado quando o snapshot realmente mudar.');
assert.match(pagesStep,/--request POST[\s\S]*\/pages\/builds/,'Sync validado deve solicitar explicitamente o build da revisão mais recente no GitHub Pages.');

const validator = fs.readFileSync('scripts/validate-calendar-snapshot.mjs', 'utf8');
assert.match(validator, /dateInTimeZone\(process\.env\.NOW \|\| new Date\(\)\)/, 'O validador diário precisa respeitar o instante fixado pelo workflow.');
assert.ok(validator.includes('data de referência da execução'), 'A mensagem de validação deve distinguir referência fixada de relógio corrente.');

const prioritiesTest = fs.readFileSync('scripts/test-daily-priorities.mjs', 'utf8');
assert.doesNotMatch(
  prioritiesTest,
  /assert\.equal\(\s*today\.current\.pe\s*,\s*['"]PE\d+['"]\s*\)/,
  'Testes sobre o snapshot vigente não podem ficar presos a um PE literal.'
);

console.log('Guardas operacionais validadas: data fixa atravessa meia-noite, falhas são registradas, PE vigente não fica fixado e todo snapshot alterado solicita rebuild do Pages.');