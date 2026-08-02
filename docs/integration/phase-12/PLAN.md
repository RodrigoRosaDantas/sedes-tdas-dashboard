# Fase 12 — PWA e funcionamento offline

## Objetivo

Disponibilizar o módulo local de questões após instalação ou primeiro carregamento, preservando o PWA v26 e sem alterar sincronização, Notion ou estado oficial.

## Escopo

- acrescentar as seis rotas ao precache;
- acrescentar os módulos JavaScript/CSS da integração;
- acrescentar contrato de navegação, catálogo e gabarito do PE76;
- manter as 112 rotas de PE, matérias e partes do caderno oficial;
- reconhecer recursos requisitados com parâmetros `?v=` por `ignoreSearch`;
- manter navegação network-first com fallback offline;
- manter dados network-first com fallback para cache;
- adicionar atalhos Estudar, Revisar, Caderno e Desempenho ao manifesto;
- atualizar a mensagem offline do player;
- adicionar gate específico ao `npm run check`.

## Fora do escopo

- background sync;
- push notification;
- sincronização entre dispositivos;
- envio de dados locais;
- writeback no Notion;
- alteração do workflow Notion;
- merge ou publicação automática.
