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

assert.match(workflow,/permissions:[\s\S]*contents: write[\s\S]*pages: write/,'O sync precisa de permissão explícita para publicar no GitHub Pages.');
const publishStart=workflow.indexOf('- name: Criar conjunto integral validado');
const promoteStart=workflow.indexOf('\n      - name: Promover atomicamente para main',publishStart);
const pagesStart=workflow.indexOf('\n      - name: Publicar e confirmar revisão sincronizada no GitHub Pages',promoteStart);
assert.ok(publishStart>=0&&promoteStart>publishStart&&pagesStart>promoteStart,'Publicação deve gerar snapshot, promover main e só então tratar o Pages.');
const publishStep=workflow.slice(publishStart,promoteStart);
assert.match(publishStep,/id: publish/,'Etapa de publicação precisa expor se houve mudança.');
assert.match(publishStep,/changed=false.*GITHUB_OUTPUT/s,'Sync sem alteração precisa sinalizar que não há rebuild necessário.');
assert.match(publishStep,/changed=true.*GITHUB_OUTPUT/s,'Sync com alteração precisa sinalizar rebuild necessário.');
const pagesStep=workflow.slice(pagesStart);
assert.match(pagesStep,/steps\.publish\.outputs\.changed == 'true'/,'Pages só deve ser tratado quando o snapshot realmente mudar.');
assert.match(pagesStep,/target_sha="\$\(git rev-parse HEAD\)"/,'Publicação deve fixar o SHA exato produzido pelo sync.');
assert.match(pagesStep,/branches\/main[\s\S]*\.commit\.sha/,'Publicação deve confirmar que a main já aponta para o SHA sincronizado.');
assert.match(pagesStep,/pages\/builds\/latest/,'Publicação deve observar o build mais recente do Pages.');
assert.match(pagesStep,/pages_commit.*target_sha[\s\S]*pages_status.*built/s,'Se o SHA sincronizado já estiver built, a etapa deve encerrar com sucesso sem rebuild duplicado.');
assert.match(pagesStep,/pages_status.*building.*pages_status.*queued/s,'A etapa deve esperar builds automáticos em andamento antes de decidir por rebuild.');
assert.match(pagesStep,/stable_without_target/,'A ausência de build do SHA alvo precisa ser confirmada por mais de uma leitura antes de solicitar rebuild.');
assert.match(pagesStep,/gh api --method POST [^\n]*pages\/builds/,'Se necessário, o sync deve solicitar explicitamente um novo build do Pages.');
assert.match(pagesStep,/previous_build_url/,'Após POST, a confirmação deve exigir um build novo em vez de reaproveitar o registro anterior.');
assert.match(pagesStep,/pages_commit.*target_sha/s,'A publicação final precisa pertencer ao SHA exato do sync.');
assert.match(pagesStep,/pages_status.*== 'built'/s,'Sync só pode confirmar a publicação quando o SHA alvo terminar como built.');
assert.match(pagesStep,/pages_status.*== 'errored'/s,'Falha do build do SHA alvo precisa falhar a etapa de publicação.');
assert.doesNotMatch(pagesStep,/response[\s\S]*\.commit/,'A resposta do POST não deve ser tratada como se trouxesse obrigatoriamente o commit do build.');

const validator = fs.readFileSync('scripts/validate-calendar-snapshot.mjs', 'utf8');
assert.match(validator, /dateInTimeZone\(process\.env\.NOW \|\| new Date\(\)\)/, 'O validador diário precisa respeitar o instante fixado pelo workflow.');
assert.ok(validator.includes('data de referência da execução'), 'A mensagem de validação deve distinguir referência fixada de relógio corrente.');

const prioritiesTest = fs.readFileSync('scripts/test-daily-priorities.mjs', 'utf8');
assert.doesNotMatch(
  prioritiesTest,
  /assert\.equal\(\s*today\.current\.pe\s*,\s*['"]PE\d+['"]\s*\)/,
  'Testes sobre o snapshot vigente não podem ficar presos a um PE literal.'
);

console.log('Guardas operacionais validadas: data fixa atravessa meia-noite, falhas são registradas, PE vigente não fica fixado e Pages confirma idempotentemente o SHA exato, com rebuild apenas quando necessário.');