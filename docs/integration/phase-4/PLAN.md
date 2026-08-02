# Plano de alteração — Fase 4

## Objetivo

Ativar um player funcional para o catálogo piloto do PE76, mantendo respostas e resultado exclusivamente em memória.

## Fluxo

1. carregar o catálogo sem gabarito;
2. iniciar uma sessão imutável;
3. exibir uma questão por vez;
4. registrar respostas A–E somente no objeto em memória;
5. apresentar mapa, progresso e cronômetro;
6. impedir finalização com pendências;
7. buscar o gabarito somente ao finalizar;
8. calcular pontuação e tempo;
9. apresentar resultado temporário;
10. eliminar a sessão ao sair ou atualizar.

## Fora do escopo

- persistência em `localStorage`;
- histórico de tentativas;
- confiança, dúvida, chute ou anulabilidade;
- inclusão automática no caderno de erros;
- revisões programadas;
- sincronização com Notion;
- atualização do PE76 oficial;
- publicação pública.

## Critérios de saída

- sessão imutável;
- dez respostas obrigatórias;
- gabarito solicitado somente na finalização;
- resultado 10/10 e 9/10 corretamente calculado;
- tempo formatado;
- nenhuma escrita local ou remota;
- rota Resolver ativa;
- testes específicos aprovados.
