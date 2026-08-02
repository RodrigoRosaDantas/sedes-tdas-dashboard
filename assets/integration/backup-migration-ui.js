import {escapeHTML} from '../common.js?v=24.1';
import {readAttempts, saveAttempt} from './attempt-store.js?v=1.0.0';
import {applyLegacyMigration, createStudyBackup, previewLegacyMigration, restoreStudyBackup, validateStudyBackup} from './backup-migration-core.js?v=1.0.0';

const waitForMorePage = () => new Promise((resolve, reject) => {
  let attempts = 0;
  const check = () => {
    const main = document.querySelector('main');
    if (main?.querySelector('.hero h1')?.textContent.trim() === 'Mais') return resolve(main);
    if (attempts++ >= 100) return reject(new Error('A página Mais não ficou pronta para backup.'));
    setTimeout(check, 40);
  };
  check();
});

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function statusMessage(container, title, detail, kind = 'ok') {
  container.innerHTML = `<article class="card panel"><small>${escapeHTML(kind === 'error' ? 'Operação bloqueada' : 'Operação concluída')}</small><h3>${escapeHTML(title)}</h3><p>${escapeHTML(detail)}</p></article>`;
}

try {
  const main = await waitForMorePage();
  const footer = main.querySelector('footer');
  const section = document.createElement('section');
  section.className = 'section';
  section.dataset.backupMigration = 'phase-10';
  section.innerHTML = `
    <div class="section-head"><div><h2>Backup e migração local</h2><p>Proteção do namespace TDAS e importação opt-in do histórico antigo de Rodrigo/Cargo 202.</p></div><span class="stamp">Fase 10</span></div>
    <div class="grid two">
      <article class="card panel">
        <h3>Backup verificável</h3>
        <p>Exporta todas as chaves TDAS e uma cópia das chaves legadas, com checksum SHA-256.</p>
        <div class="hero-actions"><button class="btn primary" data-backup-export>Exportar backup</button><label class="btn">Restaurar backup<input type="file" accept="application/json,.json" data-backup-import hidden></label></div>
      </article>
      <article class="card panel">
        <h3>Migração segura</h3>
        <p>Somente tentativas completas, identificadas como Rodrigo, Cargo 202 e com PE válido são importadas. A origem antiga não é apagada.</p>
        <div class="hero-actions"><button class="btn" data-migration-preview>Ver diagnóstico</button><button class="btn primary" data-migration-apply disabled>Aplicar parcela compatível</button></div>
      </article>
    </div>
    <div data-backup-status aria-live="polite"></div>`;
  footer?.before(section);

  const status = section.querySelector('[data-backup-status]');
  const applyButton = section.querySelector('[data-migration-apply]');
  let migrationPlan = null;

  section.querySelector('[data-backup-export]').addEventListener('click', async () => {
    try {
      const backup = await createStudyBackup();
      downloadJson(`tdas-backup-${new Date(backup.createdAt).toISOString().slice(0, 10)}.json`, backup);
      statusMessage(status, 'Backup exportado', `Checksum ${backup.checksum.slice(0, 16)}…; nenhuma chave foi alterada.`);
    } catch (error) {
      statusMessage(status, 'Não foi possível exportar', error.message, 'error');
    }
  });

  section.querySelector('[data-backup-import]').addEventListener('change', async event => {
    const [file] = event.target.files || [];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      await validateStudyBackup(backup);
      const result = await restoreStudyBackup(backup, undefined, {includeLegacy: false});
      statusMessage(status, 'Namespace TDAS restaurado', `${result.restoredTdasKeys} chaves processadas. As chaves legadas atuais não foram sobrescritas.`);
    } catch (error) {
      statusMessage(status, 'Restauração recusada', error.message, 'error');
    } finally {
      event.target.value = '';
    }
  });

  section.querySelector('[data-migration-preview]').addEventListener('click', () => {
    try {
      migrationPlan = previewLegacyMigration();
      applyButton.disabled = migrationPlan.compatible.length === 0;
      const reasons = Object.entries(migrationPlan.blocked.reduce((summary, item) => {
        summary[item.reason] = (summary[item.reason] || 0) + 1;
        return summary;
      }, {})).map(([reason, count]) => `${reason}: ${count}`).join(' · ');
      statusMessage(status, 'Diagnóstico da migração', `${migrationPlan.compatible.length} compatível(is), ${migrationPlan.blocked.length} bloqueada(s), ${migrationPlan.total} total.${reasons ? ` Motivos: ${reasons}.` : ''}`);
    } catch (error) {
      migrationPlan = null;
      applyButton.disabled = true;
      statusMessage(status, 'Diagnóstico bloqueado', error.message, 'error');
    }
  });

  applyButton.addEventListener('click', async () => {
    if (!migrationPlan?.compatible.length) return;
    try {
      const backup = await createStudyBackup();
      downloadJson(`tdas-pre-migracao-${new Date(backup.createdAt).toISOString().slice(0, 10)}.json`, backup);
      const result = applyLegacyMigration(migrationPlan, readAttempts, saveAttempt);
      applyButton.disabled = true;
      statusMessage(status, 'Migração aplicada', `${result.imported} tentativa(s) importada(s), ${result.blocked} bloqueada(s), ${result.totalStored} no histórico TDAS. Fonte legada preservada: ${result.sourcePreserved ? 'sim' : 'não'}.`);
    } catch (error) {
      statusMessage(status, 'Migração revertida', error.message, 'error');
    }
  });
} catch (error) {
  console.error('Falha ao preparar backup e migração', error);
}
