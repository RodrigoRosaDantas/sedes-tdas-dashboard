# Operação do Site TDAS

Este documento consolida as rotinas técnicas, os comandos oficiais e os monitoramentos da plataforma `sedes-tdas-dashboard`.

## 1. Hierarquia operacional

1. **Notion:** fonte editorial e operacional viva.
2. **GitHub `main`:** contrato técnico, snapshots, testes e histórico.
3. **GitHub Pages:** publicação consumida pelo usuário.

O site não deve reconstruir nem corrigir informações do Notion. Toda publicação precisa passar pelos validadores antes de chegar à `main`.

## 2. Rotina automática — horário de Brasília

| Rotina | Horários | Função |
|---|---|---|
| Sincronização Notion → GitHub | 00h50, 06h50, 12h50 e 18h50 | Consulta as fontes oficiais, gera os snapshots, executa os gates e promove atomicamente a publicação válida. |
| Monitor do Banco Discursivo | 01h20, 07h20, 13h20 e 19h20 | Confere sequência, contrato 1.1, arquivos individuais, aplicação cega e integração offline. |
| Monitor da publicação e GitHub Pages | 02h20, 08h20, 14h20 e 20h20, além da execução imediata após a sincronização | Compara calendário, manifesto, material, questões, histórico e a publicação realmente implantada. |
| Auditoria preventiva PE79–PE112 | 02h20 | Audita as páginas futuras oficiais do Notion sem escrever nelas. |
| Navegador geral | 06h15 | Testa página inicial, retomada, revisão, auditoria, questões, versão e proteção do gabarito. |
| Navegador do Banco Discursivo | 07h35 | Testa mobile, filtros, abas, parágrafos, bloqueio futuro e persistência offline. |

As rotinas agendadas do ciclo PE79–PE112 são dispensadas após 6 de setembro de 2026 quando essa regra estiver prevista no próprio workflow. O último snapshot válido deve ser preservado.

## 3. Comandos oficiais

### Gate integral

```bash
npm run check
```

Executa todos os testes estruturais, pedagógicos, de dados, PWA, redações, versão e guardas operacionais.

### Site e contratos principais

```bash
npm run check:site
```

Valida manifesto consolidado, PWA e publicação do Banco Discursivo.

### Rotinas e workflows

```bash
npm run check:operations
```

Confere os comandos, gatilhos, cronogramas, watchdogs, dependências do gerador e documentação operacional.

### Monitor da publicação local

```bash
npm run monitor:publication
```

Compara calendário, snapshot, PE, material, questões, contrato diário, histórico e idade da sincronização na cópia atual do repositório.

### Monitor do Banco Discursivo

```bash
npm run monitor:redactions
```

Executa as guardas de cache, versionamento, cronologia, reescritas, aplicação cega e contrato discursivo.

### Monitor do GitHub Pages

```bash
npm run monitor:live-site
```

Consulta o GitHub Pages com invalidação de cache e compara:

- `data/platform-version.json` da `main` e do site;
- identidade da publicação;
- versão do service worker;
- PE e horário de sincronização;
- contrato e indicadores do Banco Discursivo;
- página inicial e rota de redações;
- primeira proposta futura bloqueada e ausência de conteúdo reservado.

O monitor repete a consulta durante a janela de propagação do deploy antes de abrir ou atualizar um incidente.

### Diagnóstico local resumido

```bash
npm run ops:check
```

Executa as guardas operacionais e os contratos principais sem consultar a internet.

### Validação completa com site implantado

```bash
npm run ops:full
```

Executa o gate integral e, em seguida, compara o GitHub Pages com a publicação da `main`.

### Auditoria do ciclo diário

```bash
npm run audit:daily-cycle
```

Audita PE79–PE112 diretamente no Notion. Requer `NOTION_TOKEN` e não realiza escrita.

### Regeneração do Banco Discursivo

```bash
npm run sync:redactions
```

Regenera os arquivos discursivos a partir dos dados já preparados. A publicação oficial continua dependente do workflow completo de sincronização.

## 4. Rotina antes de alterar o site

1. Consultar a governança vigente no Notion.
2. Confirmar a `main` atual e a inexistência de PR cumulativo concorrente.
3. Conferir issues técnicas abertas e branches `sync-errors/run-*` recentes.
4. Criar branch própria a partir da `main` confirmada.
5. Aplicar intervenção mínima.
6. Executar `npm run check`.
7. Executar o navegador pertinente ao módulo alterado.
8. Abrir PR com causa, correção, testes e risco residual.
9. Integrar apenas com todos os gates verdes e sem threads pendentes.

## 5. Rotina após o merge

1. Confirmar o commit na `main`.
2. Verificar a sincronização oficial quando arquivos de geração ou dados forem alterados.
3. Confirmar o novo `publicationId` no manifesto.
4. Conferir o monitor do GitHub Pages.
5. Confirmar que o site implantado serve a mesma publicação da `main`.
6. Verificar o Banco Discursivo, o service worker e a aplicação cega.
7. Fechar o incidente técnico somente após uma execução saudável posterior.

## 6. Tratamento de falhas

### Falha de sincronização

- a `main` deve permanecer intacta;
- o último snapshot válido continua publicado;
- o diagnóstico é registrado em `data/sync-history.json`;
- uma branch `sync-errors/run-<id>-<tentativa>` é criada;
- não repetir automaticamente erros determinísticos de validação.

### Site implantado divergente

O watchdog mantém um único incidente com o título operacional do monitor. O incidente deve conter:

- publicação esperada e encontrada;
- versão, PE e horário;
- divergências do manifesto;
- estado do Banco Discursivo;
- verificação da proposta futura bloqueada;
- link da execução do GitHub Actions.

### Recuperação

Uma verificação posterior saudável adiciona o registro de recuperação e fecha o incidente. O fechamento nunca deve ocorrer apenas porque a internet voltou ou porque uma execução foi reiniciada.

## 7. Proteções permanentes

- O gabarito continua fora do precache inicial.
- Propostas futuras permanecem sem comando, texto, nota, feedback ou modelo até a data de liberação.
- Caches pessoais `tdas-redactions-user-*` não podem ser apagadas por atualização técnica.
- O Notion não recebe writeback do site.
- A versão exibida deve vir de `data/platform-version.json`.
- A camada privada completa das redações depende de backend autenticado e permanece acompanhada pela issue #86.
