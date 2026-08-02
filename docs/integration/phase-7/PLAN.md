# Plano de alteração — Fase 7

## Objetivo

Gerar e executar uma agenda local de revisões D+1, D+7 e D+20, mantendo D0 como opção excepcional e impedindo ciclos recursivos.

## Fluxo do piloto

1. concluir e classificar a tentativa;
2. salvar a tentativa local;
3. selecionar erros confirmados, dúvidas, chutes e marcações;
4. criar D+1, D+7 e D+20;
5. deduplicar por tentativa, questão e etapa;
6. bloquear a abertura antes do vencimento.

## Fluxo da revisão

1. abrir um item vencido em `/resolver/?review=...`;
2. carregar somente a questão agendada;
3. responder e classificar novamente;
4. salvar tentativa com `mode=review` e `sourceReviewId`;
5. encerrar o item com o resultado;
6. não gerar nova sequência de revisões.

## D0

D0 existe no contrato técnico, mas somente é incluído quando `includeD0=true`. O player usa explicitamente `includeD0=false`.

## Fora do escopo

- promoção ou rebaixamento adaptativo das etapas;
- notificações externas;
- sincronização entre dispositivos;
- escrita no Notion;
- progresso oficial;
- publicação pública.

## Critérios de saída

- datas exatas;
- itens elegíveis corretos;
- D0 opt-in;
- deduplicação;
- vencimento e conclusão;
- abertura antecipada bloqueada na interface;
- tentativa de revisão distinta;
- nenhuma agenda recursiva;
- corrupção preservada e reportada;
- testes aprovados.
