# Inventário de arquivos — Fase 8

## Arquivos novos

- `assets/integration/pe-progress-store.js` — progresso piloto separado por PE;
- `assets/integration/completion-transaction.js` — commit e rollback das estruturas locais;
- `assets/integration/pe-pilot-status.js` — painel somente leitura do PE76;
- `scripts/test-pe-progress-store.mjs`;
- `scripts/test-completion-transaction.mjs`;
- `scripts/validate-pe-integration.mjs`;
- documentação da Fase 8.

## Arquivos modificados

- `assets/integration/player.js` — usa a transação central e bloqueia revisão futura por URL;
- `pe/76/index.html` — carrega o painel piloto local;
- validadores de tentativa, classificação e revisões — verificam a nova coordenação;
- `package.json` — adiciona `check:pe` e `test:pe`.

## Arquivos preservados

- dados oficiais do PE76;
- lógica de `assets/pe.js`;
- Notion;
- service worker, manifesto e workflows;
- demais páginas PE;
- acervo oficial de erros.
