# Plano de alteração — Fase 8

## Objetivo

Integrar o piloto ao contexto do PE76 sem transformar atividade local em execução oficial e sem permitir gravações parciais.

## Progresso local

Cada PE possui registro separado com:

- tentativas piloto;
- revisões concluídas;
- melhor e último percentual;
- última atividade;
- respostas, acertos e erros acumulados;
- IDs deduplicados.

Os invariantes são `scope=pilot-local`, `officialCompleted=false`, `officialStatus=not_modified` e `notionWriteback=false`.

## Transação

1. capturar as cinco chaves locais;
2. salvar tentativa;
3. atualizar erros e marcações;
4. agendar ou concluir revisão;
5. atualizar progresso local do PE;
6. confirmar o conjunto;
7. em falha, restaurar o snapshot integral.

## Página PE76

O detalhamento oficial continua sendo renderizado por `assets/pe.js`. Um painel adicional, somente leitura, é inserido depois e rotulado como atividade piloto local.

## Fora do escopo

- concluir o PE76 oficial;
- alterar resultado, meta ou status oficial;
- escrita no Notion;
- sincronização entre dispositivos;
- demais PE;
- publicação pública.

## Critérios de saída

- PE01–PE112 aceitos e PE113 rejeitado;
- deduplicação;
- piloto e revisão separados;
- rollback integral comprovado;
- painel somente leitura;
- revisão futura bloqueada também por URL;
- testes aprovados.
