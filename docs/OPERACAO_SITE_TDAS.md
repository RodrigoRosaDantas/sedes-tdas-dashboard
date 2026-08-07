# Operação do Site TDAS + EDAS

Este documento consolida as rotinas técnicas, os comandos oficiais e os monitoramentos da plataforma `sedes-tdas-dashboard`, incluindo TDAS/Cargo 202, Banco Discursivo e EDAS/Administração/Cargo 400.

## 1. Hierarquia operacional

1. **Notion:** fonte editorial e operacional viva.
2. **GitHub `main`:** contrato técnico, snapshots, testes e histórico.
3. **GitHub Pages:** publicação consumida pelo usuário.

O site não deve reconstruir nem corrigir informações do Notion. Toda publicação precisa passar pelos validadores antes de chegar à `main`.

## 2. Rotinas automáticas — horário de Brasília

| Rotina | Horários | Função |
|---|---|---|
| Sincronização TDAS Notion → GitHub | 00h50, 06h50, 12h50 e 18h50 | Consulta as fontes oficiais, gera snapshots, executa gates e promove atomicamente a publicação válida. |
| Monitor do Banco Discursivo | 01h20, 07h20, 13h20 e 19h20 | Confere sequência, contrato, arquivos individuais, aplicação cega e integração offline. |
| Monitor da publicação TDAS e GitHub Pages | 02h20, 08h20, 14h20 e 20h20 | Compara calendário, manifesto, material, questões, histórico e a publicação implantada. |
| Auditoria preventiva PE79–PE112 | 02h20 | Audita as páginas futuras oficiais do TDAS sem escrever nelas. |
| Navegador geral TDAS | 06h15 | Testa central, retomada, revisão, auditoria, questões, versão e proteção do gabarito. |
| Navegador do Banco Discursivo | 07h35 | Testa mobile, filtros, abas, parágrafos, bloqueio futuro e persistência offline. |
| Revalidação editorial EDAS | 01h20, 07h20, 13h20 e 19h20 | Horários oficiais registrados no snapshot EDAS para releitura das fontes e atualização controlada do Cargo 400. |
| Watchdog EDAS + GitHub Pages | 01h45, 07h45, 13h45 e 19h45 | Confere versão, Sprint, catálogo, quantidade, histórico, PWA, correção reservada e publicação implantada. |
| Navegador EDAS | 07h50 | Testa home, mobile, player, ausência do gabarito antes do fechamento, carga da correção após finalizar e service worker. |

As rotinas agendadas ligadas ao ciclo até a prova podem ser dispensadas após 6 de setembro de 2026 quando essa regra estiver prevista no workflow. O último snapshot válido deve ser preservado.

## 3. Comandos oficiais

### Gate integral

```bash
npm run check
```

Executa os testes estruturais, pedagógicos, de dados, PWA, redações, EDAS, versão e guardas operacionais.

### Site e contratos principais

```bash
npm run check:site
```

Valida os contratos principais do TDAS, Banco Discursivo e EDAS.

### Rotinas e workflows

```bash
npm run check:operations
```

Confere comandos, gatilhos, cronogramas, watchdogs e documentação operacional dos dois cargos.

### TDAS

```bash
npm run monitor:publication
npm run monitor:redactions
npm run monitor:live-site
```

O primeiro confere a publicação técnica TDAS, o segundo o Banco Discursivo e o terceiro compara a `main` com o GitHub Pages.

### EDAS

```bash
npm run check:edas
npm run monitor:edas
npm run monitor:edas-live
npm run test:edas-operations
npm run test:edas-browser
```

- `check:edas` / `monitor:edas`: validam versão, Sprint, 42 Sprints planejados, catálogo, quantidade, `answer-key`, histórico, PWA e separação da correção.
- `monitor:edas-live`: compara a `main` com o GitHub Pages do EDAS e exige a mesma versão, snapshot, Sprint, catálogo e service worker.
- `test:edas-operations`: impede regressões nos workflows, horários, comandos e precache.
- `test:edas-browser`: executa Chrome real; o `answer-key` não pode ser requisitado nem estar em cache antes da finalização da sessão.

### Diagnóstico local resumido

```bash
npm run ops:check
```

Executa as guardas operacionais e contratos principais de TDAS e EDAS sem consultar o GitHub Pages.

### Validação completa com site implantado

```bash
npm run ops:full
```

Executa o gate integral e compara tanto TDAS quanto EDAS com as publicações no GitHub Pages.

### Auditoria do ciclo TDAS

```bash
npm run audit:daily-cycle
```

Audita PE79–PE112 diretamente no Notion. Requer `NOTION_TOKEN` e não realiza escrita.

### Regeneração do Banco Discursivo

```bash
npm run sync:redactions
```

Regenera os arquivos discursivos a partir dos dados preparados. A publicação oficial continua dependente do workflow completo.

## 4. Rotina antes de alterar o site

1. Consultar a governança vigente no Notion.
2. Confirmar a `main` atual e a inexistência de PR cumulativo concorrente.
3. Conferir issues técnicas e branches de diagnóstico recentes.
4. Criar branch própria a partir da `main` confirmada.
5. Aplicar intervenção mínima e preservar o isolamento entre Cargo 202 e Cargo 400.
6. Executar `npm run check`.
7. Executar o navegador pertinente ao módulo alterado.
8. Abrir PR com causa, correção, testes e risco residual.
9. Integrar apenas com todos os gates verdes e sem threads pendentes.

## 5. Rotina após o merge

1. Confirmar o commit na `main`.
2. Verificar a sincronização oficial quando dados ou geradores TDAS forem alterados.
3. No EDAS, confirmar a versão `meta.version`, `snapshotDate`, Sprint e `sync-history.json` após cada atualização de dados.
4. Conferir o watchdog correspondente e o GitHub Pages.
5. Confirmar que a publicação implantada serve os mesmos contratos da `main`.
6. Verificar service worker, catálogo, aplicação cega e correções reservadas.
7. Fechar incidente somente após execução saudável posterior.

## 6. Tratamento de falhas

### Falha TDAS

- a `main` deve permanecer intacta;
- o último snapshot válido continua publicado;
- o diagnóstico é registrado em `data/sync-history.json`;
- branches `sync-errors/run-*` são usadas quando aplicável.

### Falha EDAS

- não substituir snapshot, catálogo ou material por dados parciais;
- preservar a última bateria autorizada quando a fonte de questões estiver indisponível;
- registrar a indisponibilidade em `edas-administracao/data/sync-history.json`;
- o watchdog aceita catálogo anterior somente quando a preservação estiver documentada por evento de warning;
- divergência não documentada entre Sprint e catálogo é falha.

### Site implantado divergente

Os watchdogs mantêm incidentes únicos por módulo e registram publicação esperada/encontrada, versão, data, Sprint/PE, catálogo, PWA e link da execução.

### Recuperação

Uma verificação posterior saudável registra a recuperação e fecha o incidente. O fechamento nunca ocorre apenas porque a conexão voltou ou a execução foi reiniciada.

## 7. Proteções permanentes

- O gabarito TDAS continua fora do precache inicial.
- O `edas-administracao/data/integration/answer-key.json` também deve permanecer fora do precache; o player só o solicita na finalização.
- Atualizações do service worker EDAS removem cópias antigas do `answer-key` que tenham sido pré-carregadas por versões anteriores.
- O catálogo público EDAS não pode conter campos `gabarito` ou `justificativa`.
- Propostas futuras do Banco Discursivo permanecem sem comando, texto, nota, feedback ou modelo até a liberação.
- Caches pessoais `tdas-redactions-user-*` não podem ser apagadas por atualização técnica.
- O Notion não recebe writeback do site.
- A camada privada completa das redações permanece acompanhada pela issue #86.
- Como o repositório é público, o arquivo de correção EDAS ainda é tecnicamente acessível por URL direta; a retirada total desse risco exige backend/autorização e deve ser tratada como melhoria arquitetural separada.
