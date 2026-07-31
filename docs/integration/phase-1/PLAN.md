# Plano de alteração — Fase 1

## Objetivo

Criar a base contratual da futura integração sem alterar comportamento, navegação, cache, dados oficiais ou publicação.

## Intervenção mínima

1. registrar snapshot e hashes dos arquivos centrais;
2. declarar origem e política de reutilização;
3. reservar namespace exclusivo do Cargo 202 e de Rodrigo;
4. declarar estados de resposta e elegibilidade para o caderno de erros;
5. declarar política de revisão D+1, D+7 e D+20, com D0 excepcional;
6. criar validador sem efeitos colaterais;
7. encadear o validador novo ao validador existente por `npm run check`.

## Fora do escopo

- rotas;
- telas;
- player;
- catálogo piloto;
- localStorage em produção;
- migração de histórico;
- service worker;
- manifesto;
- escrita no Notion;
- mudanças em workflows;
- merge ou deploy.

## Critérios de saída

- contratos JSON e JavaScript coerentes;
- dez chaves locais únicas sob `tdas.202.study.v1.`;
- apenas `incorrect_confirmed` elegível para erro definitivo;
- resposta em branco impedida de virar erro;
- anulabilidade pendente impedida de virar erro;
- PE limitado a PE01–PE112;
- nenhum vínculo do contrato com o runtime.
