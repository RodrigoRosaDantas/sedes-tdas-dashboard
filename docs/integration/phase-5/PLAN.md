# Plano de alteração — Fase 5

## Objetivo

Persistir tentativas concluídas do piloto em armazenamento local controlado, sem persistir a sessão ativa e sem atualizar o progresso oficial.

## Fluxo

1. corrigir a sessão completa;
2. converter avaliação e catálogo em registro normalizado;
3. fixar perfil Rodrigo, Cargo 202 e PE76;
4. marcar o registro como piloto;
5. definir `officialProgress=false` e `notionWriteback=false`;
6. gravar em `tdas.202.study.v1.attempts`;
7. deduplicar pelo ID da sessão;
8. ordenar por conclusão mais recente;
9. limitar a 100 registros;
10. rejeitar estrutura corrompida sem sobrescrevê-la.

## Fora do escopo

- persistência de sessão incompleta;
- migração de histórico legado;
- classificação de dúvida, chute ou anulabilidade;
- caderno de erros;
- revisões;
- painéis de desempenho;
- backup ou restauração;
- escrita no Notion;
- publicação pública.

## Critérios de saída

- somente tentativa concluída é salva;
- registro individual por questão;
- namespace oficial;
- deduplicação;
- limite de 100;
- proteção contra corrupção;
- zero writeback;
- testes e validações aprovados.
