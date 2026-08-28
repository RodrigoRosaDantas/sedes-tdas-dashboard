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
| Navegador geral TDAS | 06h15 | Testa central, retomada, Prioridades, auditoria, questões, versão e proteção do gabarito. |
| Navegador mobile TDAS | 07h05 | Testa Home orientada ao PE, header compacto, cinco ações inferiores, drawer, Configurações, preferências locais, PWA e gabarito fora do cache inicial. |
| Navegador do Banco Discursivo | 07h35 | Testa mobile, filtros, abas, parágrafos, bloqueio futuro e persistência offline. |
| Revalidação editorial EDAS | 01h20, 07h20, 13h20 e 19h20 | Horários oficiais registrados no snapshot EDAS para releitura das fontes e atualização controlada do Cargo 400. |
| Watchdog EDAS + GitHub Pages | 01h45, 07h45, 13h45 e 19h45 | Confere versão, Sprint, catálogo, quantidade, histórico, PWA, correção reservada e publicação implantada. |
| Navegador EDAS | 07h50 | Testa home, mobile, player, ausência do gabarito antes do fechamento, carga da correção após finalizar e service worker. |

Nas verificações agendadas e nas execuções originadas pela sincronização oficial, o watchdog TDAS exige no máximo **180 minutos** desde a última sincronização válida. Em `push` técnico na `main`, a tolerância de frescor é **480 minutos**, porque o merge pode ocorrer entre duas janelas oficiais de sincronização; nesse caso, paridade entre `main`, GitHub Pages e shell continua obrigatória e o próximo monitor agendado mantém o gate estrito de 180 minutos.

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
npm run test:tdas-mobile-ux
npm run test:tdas-mobile-browser
```

- `monitor:publication`: confere a publicação técnica TDAS.
- `monitor:redactions`: confere o Banco Discursivo.
- `monitor:live-site`: compara a `main` com o GitHub Pages.
- `test:tdas-mobile-ux`: valida o contrato estrutural da experiência mobile, Configurações, separação de versões e PWA.
- `test:tdas-mobile-browser`: executa Chrome real em viewport mobile e valida header, navegação, drawer, preferências e gabarito fora do cache inicial.

O workflow **Validar persistência local TDAS** protege o contrato atual: sessão ativa local, tentativa concluída efêmera, sem Firebase/histórico pessoal e sem revisão interna.

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

## 4. Padrão de experiência TDAS

A experiência do Cargo 202 é orientada à **execução diária**, sem compartilhar dados com o Cargo 400.

- A Home responde primeiro **o que fazer agora**, usando o PE vigente, a Central de Execução e uma única ação primária coerente com o estado local/oficial.
- PE vencido e ainda não concluído permanece explícito na Home e na Agenda até a conclusão oficial; o avanço da data não pode descartá-lo do total pendente.
- O PE atual, o último PE concluído e as pendências anteriores são conceitos separados. O ritmo considera atrasos mais o calendário de hoje em diante.
- A barra inferior mobile possui exatamente cinco áreas: **Hoje, Questões, Erros, Mentor e Mais**.
- A navegação desktop prioriza **Faça agora, Resolver questões, Prioridades, Caderno de erros, Mentor, Check do Edital, Riscos, Plano PE01–PE112, Biblioteca e Bancos de dados**; opções administrativas não disputam prioridade com a execução diária.
- O drawer organiza as demais rotas em **Hoje, Conteúdo, Praticar, Progresso e Sistema**.
- Informações técnicas, instalação, publicação, backup, fontes e preferências ficam em **Configurações**; a Auditoria permanece técnica.
- Durante uma questão ativa, o player entra em modo focado: navegação periférica é escondida, resposta/confiança e posição ficam no **rascunho local da sessão ativa** e a correção permanece reservada até a finalização.
- A confiança usa linguagem direta: **Sei, Tenho dúvida e Chute**.
- Ao finalizar uma bateria, o resultado e a correção ficam disponíveis **somente na página atual, em memória**, para conferência imediata. A tentativa concluída não é gravada como histórico pessoal, não alimenta desempenho do navegador e não é enviada para nuvem.
- O TDAS não mantém mais histórico pessoal de **acertos, erros, marcações, causas de erro, revisões, telemetria consolidada ou aferições privadas do Edital**. Metadados transitórios usados durante a sessão devem ser consumidos/descartados no fechamento.
- **Prioridades** é diagnóstico/direcionamento para revisão externa. O motor D+1/D+7/D+20 e seus estados permanecem apenas como compatibilidade histórica e não podem iniciar sessão interna, preemptar a ação diária ou voltar a ser fonte operacional.
- O **Check do Edital** usa o snapshot oficial para apontar lacunas e sugerir prática. Baterias feitas no navegador não criam percentual privado por tópico nem fecham lacunas oficiais.
- O **Caderno de erros** do site funciona como gateway para o caderno oficial sincronizado, Prioridades e Mentor; não recompõe um caderno pessoal a partir do navegador.
- O **Desempenho** do site aponta para indicadores oficiais sincronizados; não acumula tentativas concluídas localmente.
- O estado de dados deve distinguir claramente a **publicação já sincronizada** de uma nova leitura do Notion. No navegador, `Verificar publicação` consulta o manifesto publicado; não chama a API do Notion nem expõe token.
- O badge de publicação é derivado do manifesto real e deve ser revalidado ao reconectar.
- Modo confortável e Texto ampliado são preferências locais isoladas pelas chaves `tdas.202.*`.
- `prefers-reduced-motion` deve ser respeitado.
- `platformVersion`, `dataVersion` e `syncAt` têm significados independentes; mudança visual não pode simular nova leitura do Notion.
- O backup local TDAS contém somente **progresso operacional local e sessão ativa**, nunca tentativas concluídas/revisões. Ele é manual e não envia arquivos para servidor.
- Atualizações do cache técnico devem preservar o rascunho da sessão ativa, preferências e dados operacionais permitidos, mas não devem reintroduzir histórico pessoal aposentado.

### Contrato de persistência TDAS

**Permitido no dispositivo:**

- rascunho de uma bateria não finalizada;
- posição e respostas da sessão ativa;
- preferências de interface;
- progresso operacional diário necessário para continuidade;
- cache técnico/PWA e caches pessoais específicos do Banco Discursivo já governados separadamente.

**Aposentado no TDAS:**

- Firebase/Firestore de histórico pessoal;
- sincronização entre dispositivos de tentativas ou rascunhos;
- histórico persistente de tentativas concluídas;
- desempenho pessoal derivado das baterias do navegador;
- caderno local acumulado de erros/marcações/causas;
- revisão interna e fila D+1/D+7/D+20;
- aferição privada persistente do Check do Edital;
- exportação de tentativa concluída como histórico do site.

A publicação oficial **Notion → GitHub → site** continua normalmente e não deve ser confundida com sincronização de dados pessoais.

## 5. Rotina antes de alterar o site

1. Consultar a governança vigente no Notion.
2. Confirmar a `main` atual e a inexistência de PR cumulativo concorrente.
3. Conferir issues técnicas e branches de diagnóstico recentes.
4. Criar branch própria a partir da `main` confirmada.
5. Aplicar intervenção mínima e preservar o isolamento entre Cargo 202 e Cargo 400.
6. Executar `npm run check`.
7. Executar o navegador pertinente ao módulo alterado.
8. Abrir PR com causa, correção, testes e risco residual.
9. Integrar apenas com todos os gates verdes e sem threads pendentes.

## 6. Rotina após o merge

1. Confirmar o commit na `main`.
2. Verificar a sincronização oficial quando dados ou geradores TDAS forem alterados.
3. No EDAS, confirmar a versão `meta.version`, `snapshotDate`, Sprint e `sync-history.json` após cada atualização de dados.
4. Conferir o watchdog correspondente e o GitHub Pages.
5. Confirmar que a publicação implantada serve os mesmos contratos da `main`.
6. Verificar service worker, catálogo, aplicação cega e correções reservadas.
7. Fechar incidente somente após execução saudável posterior.

## 7. Tratamento de falhas

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

## 8. Proteções permanentes

- O gabarito TDAS continua fora do precache inicial.
- A migração do TDAS 202 para Workers + D1 segue `docs/GABARITOS_PRIVADOS_TDAS.md`; a API privada nunca pode usar fallback público depois do corte validado.
- O `edas-administracao/data/integration/answer-key.json` também deve permanecer fora do precache; o player só o solicita na finalização.
- Atualizações do service worker EDAS removem cópias antigas do `answer-key` que tenham sido pré-carregadas por versões anteriores.
- O catálogo público EDAS não pode conter campos `gabarito` ou `justificativa`.
- Propostas futuras do Banco Discursivo permanecem sem comando, texto, nota, feedback ou modelo até a liberação.
- Caches pessoais `tdas-redactions-user-*` não podem ser apagadas por atualização técnica.
- No TDAS, **somente o rascunho da sessão ativa, preferências e progresso operacional permitido** podem sobreviver como persistência local de execução. O histórico antigo `tdas.202.question-module.v2.state`, causas de erro e aferições privadas não podem voltar a ser fonte operacional.
- Nenhum workflow, pós-processador ou service worker pode reintroduzir `private-history-*`, `firebase-history-store` ou regras Firestore do histórico pessoal TDAS.
- O Notion não recebe writeback do site.
- A camada privada completa das redações permanece acompanhada pela issue #86.
- Como o repositório é público, o arquivo de correção EDAS ainda é tecnicamente acessível por URL direta; a retirada total desse risco exige backend/autorização e deve ser tratada como melhoria arquitetural separada.
