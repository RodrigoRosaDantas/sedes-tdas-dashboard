# Inventário de arquivos — Fase 4

## Arquivos novos

- `assets/integration/player-core.js` — estado imutável, progresso, navegação, pontuação e tempo;
- `assets/integration/player.js` — interface do piloto em memória;
- `assets/integration/player.css` — estilos específicos do player;
- `scripts/test-player.mjs` — testes unitários;
- `scripts/validate-player.mjs` — validação de isolamento e carregamento tardio do gabarito;
- documentação da Fase 4.

## Arquivos modificados

- `resolver/index.html` — ativa o player;
- `assets/integration/pilot-catalog.js` — adiciona a ação de iniciar o piloto;
- `package.json` — inclui `check:player` e `test:player`.

## Arquivos preservados

- catálogo e gabarito da Fase 3;
- armazenamento local e histórico;
- dados oficiais;
- PWA, manifesto e workflows;
- Notion.
