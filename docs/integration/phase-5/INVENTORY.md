# Inventário de arquivos — Fase 5

## Arquivos novos

- `assets/integration/attempt-store.js` — criação, leitura, deduplicação e gravação controlada;
- `scripts/test-attempt-store.mjs` — testes com armazenamento em memória;
- `scripts/validate-attempt-store.mjs` — gate de namespace, isolamento e ordem de salvamento;
- documentação da Fase 5.

## Arquivos modificados

- `assets/integration/player.js` — salva somente após correção completa;
- `scripts/validate-player.mjs` — mantém o gate de sessão ativa e writeback remoto;
- `package.json` — inclui `check:attempts` e `test:attempts`.

## Arquivos preservados

- sessão ativa e núcleo do player;
- catálogo e gabarito;
- dados oficiais;
- Notion;
- service worker, manifesto e workflows;
- chaves legadas.
