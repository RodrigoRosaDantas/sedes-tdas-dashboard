# Snapshot — Fase 1 da integração

- Captura: `2026-07-31T19:30:00-03:00`
- Repositório: `RodrigoRosaDantas/sedes-tdas-dashboard`
- Branch-base: `main`
- Commit-base: `db038c52203245bd20604f10b4203739008e55e7`
- Branch de trabalho: `agent/integracao-base-fase-1`
- Estado público preservado: Plataforma TDAS v24.1
- Corte operacional preservado: PE74 concluído; PE75 não iniciado.

## Arquivos centrais congelados

| Arquivo | Blob SHA no commit-base | Situação nesta fase |
|---|---|---|
| `index.html` | `c51652c08d2bdb54ab080349119d3949f327ab20` | não alterado |
| `assets/common.js` | `90a4b7209094ac027f6c685b8eace4b7e057c15c` | não alterado |
| `sw.js` | `5a2f92720064511dbf3bcb25b09866809b66a57b` | não alterado |
| `manifest.webmanifest` | `723796c5659d238c0cdb73437548bc01b1b4d025` | não alterado |
| `.github/workflows/notion-sync.yml` | `403066879e98d8568ba61d617e34818414c3c91a` | não alterado |
| `scripts/validate-platform.mjs` | `eeb8d9acc9d3e4bcb65e7cf488fbdce192dc1ae1` | não alterado |

## Garantias

- `main` não é alvo de escrita da Fase 1.
- Nenhuma rota pública foi adicionada.
- Nenhum script novo foi importado pelo site.
- O service worker e o manifesto permanecem únicos e intactos.
- Não houve alteração no Notion, cronograma, automações ou site público.
