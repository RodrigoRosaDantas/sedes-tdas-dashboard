# Contrato de Fontes TDAS — Cargo 202

## Finalidade

Este contrato impede que a Plataforma TDAS trate fontes operacionais de menor prioridade como substitutas do planejamento pedagógico vigente.

## Hierarquia aplicada

1. Edital oficial e cronograma oficial.
2. Macro PE01–PE112 auditado.
3. Micro semanal atualizado.
4. Banco de Controle de Questões TDAS.
5. Caderno de Erros TDAS / PRO.
6. Banco de Redação TDAS.
7. Materiais complementares.

O Macro define a arquitetura do ciclo e delega ao Micro a carga variável de cada dia. Por isso, quando o Micro fixa ou estima a bateria diária, o número do Banco de Controle não prevalece por simples maioria de fontes.

## Manifesto permitido

A leitura estrutural automática inclui somente o Dashboard PRO do Cargo 202, o Check do Edital, a raiz Macro + Micros, o Macro, os 16 Micros e as duas árvores oficiais de execução diária (Materiais Premium e Questões Diárias).

O Arquivo/Legado não integra a leitura operacional. Conteúdo do EDAS/Administração/Cargo 400 é proibido neste contrato.

## Regras de publicação

- O contrato é recalculado durante a sincronização oficial que possui `NOTION_TOKEN`.
- Os 16 Micros devem cobrir PE01–PE112 exatamente uma vez.
- O PE atual é reconciliado com Controle e catálogo de questões.
- Divergência crítica do PE atual bloqueia a publicação e preserva o último snapshot válido.
- Divergências futuras são registradas para saneamento preventivo, sem substituir o plano vigente.
- Na Semana 16, o Micro PE106–PE112 permanece soberano e adaptativo; PE111 é descanso com 0 questões e PE112 é prova oficial.
- O site não escreve no Notion e não gera questões para preencher lacunas detectadas.

## Diagnóstico público

`data/source-contract.json` registra a fonte dominante, a composição do Micro, os números do Controle e do catálogo e as divergências encontradas. A Home e o Foco de Hoje podem exibir esse diagnóstico sem alterar dados editoriais.

## Testes

- `npm run test:source-contract`: valida o parser e a política de precedência sem acesso externo.
- `npm run test:source-access`: usa o `NOTION_TOKEN` para confirmar acesso às fontes-mestre autorizadas.
- `npm run check`: inclui o teste estrutural do contrato multifornte.
