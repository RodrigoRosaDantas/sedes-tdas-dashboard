# Plano de alteração — Fase 3

## Objetivo

Criar um catálogo piloto de dez questões do PE76, fiel à fonte atual e isolado do progresso oficial, preparando os dados para o player da Fase 4.

## Seleção aprovada

- Assistência Social e SUAS: questões 1 a 6;
- Língua Portuguesa aplicada: questões 13 a 16.

## Execução

1. ler a página atual do PE76 em modo somente leitura;
2. excluir respostas e dados pessoais do candidato;
3. adaptar o esquema estável do repositório-fonte;
4. gerar catálogo sem gabarito;
5. manter o gabarito em arquivo técnico separado;
6. calcular hash SHA-256 das questões;
7. exibir somente o resumo na rota Estudar;
8. validar IDs, seleção, alternativas, texto-base e isolamento;
9. encadear o teste ao `npm run check`.

## Fora do escopo

- resolução interativa;
- cronômetro;
- correção na tela;
- gravação de respostas;
- classificação de confiança;
- caderno de erros;
- revisão programada;
- atualização do PE76 ou de qualquer banco no Notion;
- publicação pública.

## Critérios de saída

- exatamente dez questões;
- alternativas A–E completas;
- IDs estáveis;
- nenhuma resposta pessoal importada;
- gabarito não carregado pela tela de catálogo;
- `pilotMode=true`;
- `officialProgressWrite=false`;
- `notionWriteback=false`;
- hash validado.
