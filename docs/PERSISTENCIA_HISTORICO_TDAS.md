# Persistência privada do histórico TDAS — Cargo 202

## Arquitetura

O conteúdo oficial continua em **Notion → GitHub → site**. Respostas pessoais seguem outro fluxo, sem writeback no Notion:

`Resolver → localStorage/IndexedDB → fila idempotente → Firebase Authentication → Cloud Firestore`.

O projeto Firebase dedicado é `tdas-68014`, no plano Spark. O GitHub Pages hospeda somente a aplicação e catálogos autorizados; respostas pessoais ficam sob `/users/{uid}/...` no Firestore.

## Armazenamento local preservado

A migração é não destrutiva. Chaves atuais:
- `tdas.202.question-module.v2.state`
- `tdas.202.question-module.v2.draft`
- `tdas.202.question-module.v2.telemetry`
- `tdas.202.question-module.v2.answer-history`
- `tdas.202.daily-execution.v1`
- `tdas.202.error-causes.v1`

Também permanecem legíveis o namespace anterior `tdas.202.study.v1.*` e as chaves legadas `sedes.questoes.*` já auditadas. Nenhuma rotina de migração apaga essas fontes.

## IndexedDB

Banco `tdas-202-history-v1`, versão 1:
- `attemptDetails`: tentativas completas exportáveis;
- `remoteAttempts`: cópias autenticadas baixadas do Firestore;
- `queue`: operações com IDs idempotentes e retry;
- `drafts`: sessões incompletas;
- `meta`: auditoria e estados auxiliares remotos.

O salvamento local antecede a rede. Falha de conexão mantém a operação em fila; reconexão tenta novamente com backoff.

## Firestore

Estrutura privada:
- `/users/{uid}/attempts/{attemptId}`
- `/users/{uid}/attempts/{attemptId}/questions/{questionId}`
- `/users/{uid}/drafts/{draftId}`
- `/users/{uid}/state/{recordId}`

Tentativa e respostas são gravadas em `writeBatch`. IDs determinísticos evitam documentos duplicados em reenvios.

As regras publicadas exigem `request.auth != null && request.auth.uid == userId`. A configuração Web do Firebase é pública por natureza; nenhuma conta de serviço, chave privada administrativa ou segredo do Notion é usado no navegador.

## Sincronização e conflito

Estados de UX:
- `Salvando`
- `Salvo`
- `Pendente`
- `Sincronizado`
- `Falha ao sincronizar`

Tentativas concluídas são identificadas por `attemptId` e tratadas de forma idempotente. Rascunhos e estados mutáveis usam a data do cliente; uma versão remota não substitui silenciosamente uma versão local mais nova. Ao autenticar em outro dispositivo, tentativas, erros, marcações, revisões, causas de erro e progresso sincronizados são materializados no contrato local existente para manter compatibilidade com Desempenho e Caderno de Erros.

## Exportação

Schema de tentativa: `1.0.0`.

O JSON contém tentativa e dados questão por questão: PE, número, matéria, assunto, subassunto, enunciado, alternativas, resposta escolhida, gabarito, resultado, confiança, marcação, classificação, fundamento quando existente, fonte, tempo ativo, visitas, primeira/final resposta e histórico de trocas quando disponível.

Sessões novas registram a sequência de mudanças em `tdas.202.question-module.v2.answer-history`. Em histórico legado, uma única troca pode ser reconstruída inequivocamente por primeira/final resposta; quando existiram múltiplas mudanças e os estados intermediários nunca foram armazenados, `historyComplete` fica `false` em vez de inventar eventos.

O Caderno de Erros usa a mesma tentativa de origem e permite `Ver questão`, exportação das ocorrências selecionadas e resumo estruturado para ChatGPT.

## PE88

O código não contém os resultados pessoais do PE88 hardcoded. A migração procura a tentativa real com `peId === "PE88"` e `total === 53` no navegador e conserva exatamente seus `questionResults`.

Como o conteúdo oficial do PE88 foi posteriormente regenerado no Notion, a associação não usa apenas o número do PE. O catálogo exato que estava publicado durante a resolução foi preservado por `catalogId` em:

`data/integration/question-archive/tdas-pe88-339d718d88c1.json`

Esse arquivo veio do commit histórico `ae278b0eacb5316051ffc3c0c8678e8a9cdfb744` e contém as 53 questões daquele catálogo. Assim, a tentativa real pode ser enriquecida sem reconstruir enunciados manualmente.

Ainda não é correto afirmar que o PE88 pessoal já está no Firestore: essa confirmação só ocorre quando a versão publicada executar no navegador que possui o `localStorage` original, o usuário entrar na conta TDAS e a sincronização retornar sucesso.

## PWA

`localStorage` e IndexedDB continuam sendo a camada de segurança offline. O workflow pós-sincronização preserva no Service Worker os módulos de histórico privado, rotas de sincronização/exportação e o catálogo histórico necessário, evitando que uma regeneração Notion remova a capacidade offline.
