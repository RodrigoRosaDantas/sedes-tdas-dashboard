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
Backup e migração testados: checksum, restauração, filtros, idempotência, corrupção, preservação e rollback.
Desempenho testado: piloto/revisão/legado, confiança, assuntos, tempo, tendência, agenda e cenário vazio.
```

O clone integral falhou com `Could not resolve host: github.com`; por isso a execução completa de `npm run check` permanece pendente.
