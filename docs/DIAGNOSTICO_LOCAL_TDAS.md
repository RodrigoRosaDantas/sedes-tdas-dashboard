# Diagnóstico local acionável — TDAS Cargo 202

## Finalidade

Transformar os dados locais já existentes do módulo de questões em sinais de ação sem criar uma nova fonte oficial e sem escrever no Notion.

## Caderno de erros

Os erros confirmados são agrupados por `subassunto` quando disponível e, na ausência, por `assunto`.

Classificação visual:

- 1 ocorrência: isolado;
- 2 ocorrências: reincidente;
- 3 ou mais: crítico.

A ordenação considera primeiro a quantidade de erros e depois a recência. O registro bruto de cada questão continua disponível abaixo do diagnóstico.

## Desempenho

O escore local de risco por tópico é deliberadamente simples:

`risco = erros confirmados × 4 + incertezas × 2`

Incerteza inclui resposta correta com dúvida, resposta correta por chute e questão marcada. O escore é apenas uma prioridade local de revisão; não é percentual de domínio nem substitui a Evolução oficial.

A tendência compara, quando houver base suficiente, a média das cinco sessões de estudo mais recentes com as cinco anteriores. Sem duas janelas comparáveis, o painel mostra “Sem base comparável”.

## Limites

- somente sessões armazenadas neste dispositivo;
- nenhum percentual retroativo é inventado;
- nenhuma alteração no schema de armazenamento;
- nenhuma alteração no motor adaptativo de revisão;
- nenhuma escrita no Notion;
- nenhum dado do EDAS/Cargo 400.
