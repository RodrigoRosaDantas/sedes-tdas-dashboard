# Fase 11 — Relatório de validação cumulativa

## Resultado final

O workflow read-only `Validar integração do módulo de questões` executou `npm run check` com Node.js 22 no PR cumulativo nº 21.

- execução aprovada: `30724233450`;
- run number: `9`;
- conclusão: `success`;
- permissões: `contents: read`;
- sem secrets, deploy, push, Notion ou publicação.

## Escopo aprovado em conjunto

- plataforma pública: 112 PE, 166 erros, 32 redações, 154 HTML e 325 arquivos;
- contratos e namespace da integração;
- seis rotas com scripts funcionais autorizados;
- catálogo piloto PE76 com dez questões e hash verificado;
- player e testes de sessão;
- histórico piloto, revisão e legado;
- classificação e caderno de erros confirmados;
- revisões D+1, D+7 e D+20;
- transação e progresso local do PE76;
- desempenho derivado em leitura;
- backup, restauração e migração opt-in.

## Problemas encontrados e corrigidos pela validação real

1. chave excedente em `assets/pe.js`, corrigida sem alteração lógica;
2. validador antigo incompatível com o precache dinâmico v26;
3. gate da Fase 1 preso ao comando `check` original e incapaz de aceitar crescimento controlado;
4. rota `/desempenho/` ainda carregava a tela estrutural em vez do painel funcional;
5. gate de navegação não reconhecia scripts ativados nas fases posteriores;
6. expressão textual incorreta no validador do isolamento do player;
7. teste de tentativa desatualizado para o modo interativo versus legado;
8. expectativa do limite de 100 registros não contabilizava a tentativa de revisão.

## Estado

A candidata é mergeável e a suíte integral está aprovada. Merge e publicação continuam bloqueados até a validação de PWA/offline e a revisão final do conjunto.
