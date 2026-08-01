# Fase 10 — Plano

## Objetivo

Permitir backup verificável e migração local opt-in sem apagar dados antigos nem misturar histórico legado ao piloto atual.

## Regras

1. exportar todas as chaves TDAS e as chaves legadas conhecidas;
2. gerar checksum SHA-256 do conteúdo canônico;
3. validar escopo Rodrigo/Cargo 202 antes de restaurar ou migrar;
4. restaurar o namespace TDAS por transação com rollback;
5. preservar chaves legadas por padrão;
6. importar somente tentativas com PE, material, timestamps e resultados individuais completos;
7. bloquear perfil diferente de Rodrigo e cargo diferente de 202;
8. classificar importações como `mode=legacy`, `pilot=false` e `sourceSystem=sedes-df-questoes`;
9. não gerar caderno, revisões ou progresso oficial a partir da migração;
10. manter a operação dependente de ação explícita do usuário na página Mais.

## Fora do escopo

- migração automática ao carregar a página;
- exclusão das chaves antigas;
- sincronização entre dispositivos;
- upload do backup para serviço externo;
- writeback no Notion;
- publicação ou merge automático.
