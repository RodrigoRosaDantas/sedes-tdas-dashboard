# Inventário de arquivos — Fase 1

## Arquivos novos

| Arquivo | Finalidade | Impacto em runtime |
|---|---|---|
| `package.json` | expor comandos padronizados de validação | nenhum até execução manual/CI |
| `assets/integration/contracts.js` | contratos puros de namespace, PE e classificação | nenhum; não importado |
| `data/integration/base-contract.json` | contrato legível por máquina | nenhum; não carregado pelo site |
| `scripts/validate-integration-base.mjs` | validar a base da integração | somente desenvolvimento/CI |
| `docs/integration/ORIGIN.md` | rastrear a origem técnica | nenhum |
| `docs/integration/phase-1/SNAPSHOT.md` | congelar o estado inicial | nenhum |
| `docs/integration/phase-1/INVENTORY.md` | registrar o escopo | nenhum |
| `docs/integration/phase-1/PLAN.md` | registrar a intervenção aprovada | nenhum |
| `docs/integration/phase-1/REPORT.md` | consolidar resultados | nenhum |
| `docs/integration/phase-1/MERGE-NOTE.md` | registrar autorização e condição técnica da incorporação | nenhum |

## Arquivos deliberadamente não alterados

- páginas e rotas públicas;
- CSS atual;
- `assets/common.js` e scripts das telas;
- `sw.js`;
- `manifest.webmanifest`;
- dados atuais de PE, erros e redações;
- scripts de sincronização do Notion;
- workflows existentes;
- diretório `edas-administracao/`;
- repositório `sedes-df-questoes`.
