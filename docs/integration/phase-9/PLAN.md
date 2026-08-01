# Plano de alteração — Fase 9

## Objetivo

Construir um painel de desempenho local a partir das estruturas existentes, sem criar uma base analítica paralela.

## Métricas

- tentativas piloto e de revisão;
- questões, acertos, erros e aproveitamento;
- tempo total e médio por questão;
- melhor piloto e último resultado;
- distribuição de classificações;
- volume e acurácia por confiança;
- aproveitamento por assunto;
- revisões disponíveis, pendentes e concluídas;
- tendência das vinte últimas tentativas;
- resumo do PE76 local.

## Princípio de fonte única

A página lê `attempts`, `reviews` e `peProgress` e reconstrói as métricas a cada abertura. Nenhuma chave adicional é gravada.

## Fora do escopo

- comparação com estatísticas oficiais;
- metas ou recomendações adaptativas;
- exportação;
- sincronização entre dispositivos;
- escrita no Notion;
- publicação pública.

## Critérios de saída

- cálculos puros e testados;
- cenário vazio;
- ordenação de assuntos pelo menor aproveitamento;
- até vinte pontos de tendência;
- painel somente leitura;
- atalho para Evolução oficial;
- nenhuma gravação ou acesso ao Notion.
