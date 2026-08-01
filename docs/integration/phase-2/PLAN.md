# Plano de alteração — Fase 2

## Objetivo

Criar a navegação física do futuro módulo de questões sem ativar catálogo, player, persistência, migração, escrita no Notion ou publicação pública.

## Execução

1. congelar o commit-base e os arquivos de entrada;
2. declarar as seis rotas aprovadas em contrato JSON;
3. criar um renderizador comum e sem estado;
4. criar as páginas físicas;
5. adicionar entrada na página inicial;
6. adicionar atalhos na página Mais;
7. preservar o caderno oficial atual;
8. criar validação específica;
9. encadear a validação ao `npm run check`.

## Rotas

- `/estudar/`;
- `/resolver/`;
- `/revisar/`;
- `/caderno-erros/`;
- `/desempenho/`;
- `/fila-ia/`.

## Fora do escopo

- questões do PE76;
- alternativas e gabarito;
- cronômetro;
- histórico de tentativas;
- localStorage e migração;
- revisões automáticas;
- fila funcional de IA;
- alteração do service worker;
- escrita no Notion;
- deploy público.

## Critérios de saída

- seis rotas físicas e únicas;
- entrada na página inicial e no menu Mais;
- rota legada de erros preservada;
- ausência de persistência e de acesso ao Notion;
- JavaScript e contrato válidos;
- diff limitado ao escopo da navegação.
