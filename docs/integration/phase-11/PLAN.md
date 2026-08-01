# Fase 11 — Validação cumulativa

## Objetivo

Executar `npm run check` em GitHub Actions sobre a candidata acumulada, sem usar segredos, publicar conteúdo ou escrever no Notion.

## Workflow

- gatilhos: `pull_request` para `main` e `workflow_dispatch`;
- permissões: `contents: read`;
- ambiente: Ubuntu, Node.js 22;
- comando único de validação: `npm run check`;
- sem cache, upload, deploy, push, commit ou secrets;
- concorrência com cancelamento da execução anterior do mesmo PR.

## Condição

A execução aprovada é necessária, mas não suficiente para merge. Ainda são obrigatórias a revisão do diff acumulado, a validação de PWA/offline e a preservação do estado oficial e do Notion.
