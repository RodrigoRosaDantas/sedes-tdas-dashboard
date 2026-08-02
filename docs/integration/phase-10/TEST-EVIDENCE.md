# Evidências de teste

Executados com os arquivos atuais da branch em árvore controlada:

```text
node --check assets/integration/backup-migration-core.js
node --check assets/integration/attempt-store.js
node scripts/test-backup-migration.mjs
node scripts/test-performance-metrics.mjs
```

Resultados:

```text
Backup e migração testados: checksum, chaves autorizadas, validação semântica, restauração, filtros, idempotência, corrupção, preservação e rollback.
Desempenho testado: piloto/revisão/legado, confiança, assuntos, tempo, tendência, agenda e cenário vazio.
```

O clone integral falhou com `Could not resolve host: github.com`; por isso a execução completa de `npm run check` permanece pendente.

Em auditoria cumulativa posterior, o gate recebeu casos adversariais para impedir restauração de chave arbitrária, possível anulação/erro da fonte no caderno e resposta em branco classificada. A suíte integral passou no merge virtual do PR nº 23.
