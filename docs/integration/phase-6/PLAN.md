# Plano de alteração — Fase 6

## Objetivo

Classificar cada resposta de forma tecnicamente segura e formar um caderno local contendo apenas erros confirmados.

## Precedência

1. erro da fonte;
2. possível anulação;
3. erro confirmado;
4. marcação para revisão;
5. acerto por chute;
6. acerto com dúvida;
7. acerto seguro.

As ressalvas editoriais têm precedência sobre o resultado objetivo para impedir a formação indevida de erro definitivo.

## Fluxo

1. registrar confiança, marcação e ressalva em memória;
2. corrigir a sessão completa;
3. classificar cada resultado;
4. incorporar a classificação à tentativa;
5. salvar a tentativa;
6. indexar somente `incorrect_confirmed` em erros;
7. indexar todas as marcações separadamente;
8. exibir o caderno local em `/caderno-erros/`;
9. manter o acervo oficial em `/questoes-erros/`.

## Fora do escopo

- revisão D+1, D+7 e D+20;
- fila funcional de IA;
- alteração editorial da questão;
- migração de erros oficiais;
- escrita no Notion;
- publicação pública.

## Critérios de saída

- sete classificações reconhecidas;
- resposta em branco rejeitada;
- anulação e erro da fonte fora do caderno;
- somente erro confirmado elegível;
- marcação independente;
- deduplicação e corrupção protegidas;
- caderno local funcional;
- testes adversariais aprovados.
