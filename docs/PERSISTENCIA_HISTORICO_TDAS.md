# Persistência privada do histórico TDAS — Cargo 202

## Objetivo

Transformar a execução de questões em histórico pessoal estruturado, recuperável e exportável sem substituir o funcionamento offline existente e sem escrever no Notion.

## Fontes e responsabilidades

1. **Notion:** conteúdo e acompanhamento oficial do projeto.
2. **GitHub Pages:** aplicação pública e catálogo autorizado; nunca armazena respostas pessoais.
3. **localStorage:** cache operacional compatível com o módulo existente.
4. **IndexedDB `tdas-202-history-v1`:** arquivo local detalhado, rascunhos e fila de sincronização.
5. **Banco privado dedicado:** persistência autenticada entre dispositivos. Não pode reutilizar o projeto Supabase de outra aplicação.

## Armazenamentos locais auditados

### Estado atual
- `tdas.202.question-module.v2.state`
- `tdas.202.question-module.v2.draft`
- `tdas.202.question-module.v2.telemetry`
- `tdas.202.daily-execution.v1`
- `tdas.202.error-causes.v1`

### Namespace anterior
Prefixo `tdas.202.study.v1.`:
- `profile`
- `attempts`
- `session`
- `answers`
- `errors`
- `marked`
- `reviews`
- `aiQueue`
- `peProgress`
- `meta`

### Legado
- `sedes.questoes.activeProfile.v3`
- `sedes.questoes.profiles.v3`
- `sedes.questoes.rodrigo.history.v3`
- `sedes.questoes.rodrigo.errors.v3`
- `sedes.questoes.rodrigo.marked.v3`

A migração é **não destrutiva**: nenhuma dessas chaves é removida durante a captura.

## IndexedDB

Banco: `tdas-202-history-v1`, versão 1.

Object stores:
- `attemptDetails`: exportações completas das tentativas;
- `remoteAttempts`: cópias autenticadas recuperadas do banco central;
- `queue`: operações idempotentes aguardando sincronização;
- `drafts`: rascunhos/sessões incompletas arquivadas;
- `meta`: auditoria de migração e estado da sincronização.

## Exportação estável

Schema: `1.0.0`.

Cada arquivo contém:
- identidade lógica da tentativa;
- PE, modo, início/fim, tempo total e ativo;
- total, acertos, erros e percentual;
- revisitas e trocas;
- todas as respostas questão por questão;
- matéria, assunto, subassunto, enunciado e alternativas quando o catálogo autorizado estiver disponível;
- resposta escolhida, gabarito, resultado, confiança, marcação e classificação;
- telemetria por questão;
- fundamento/comentário somente quando existir na fonte; nunca é inventado;
- fonte/catálogo que permitiu reconstruir o conteúdo.

## PE88

O código de migração não contém números de desempenho hardcoded. Ele procura no armazenamento real uma tentativa com `peId === "PE88"` e `total === 53` e registra os valores encontrados naquele navegador. Em seguida, associa o conteúdo canônico de `data/integration/question-catalog.json` pelos IDs reais `PE88-Qxxx`.

Enquanto o site atualizado não executar no navegador que possui a tentativa, não é correto afirmar que o PE88 já foi copiado para o arquivo detalhado ou para a nuvem.

## Telemetria

A versão 1.1 é compatível com 1.0 e adiciona `answerHistory` e `historyComplete`. Sessões novas podem preservar a sequência integral das mudanças. Sessões antigas preservam `firstAnswer`, `lastAnswer` e `answerChanges`; quando os estados intermediários nunca foram armazenados, a sequência integral é marcada como incompleta em vez de ser inventada.

## Segurança do backend

O backend dedicado deve:
- exigir Supabase Auth ou autenticação equivalente;
- habilitar RLS em todas as tabelas expostas;
- permitir acesso somente quando `auth.uid() = user_id`;
- não conceder acesso pessoal ao papel `anon`;
- usar no navegador somente chave **publishable**;
- nunca incluir `service_role`, secret key ou segredo Notion no repositório;
- usar chaves compostas/idempotentes para impedir duplicação;
- manter conteúdo pessoal fora do GitHub Pages.

## Estado de sincronização

Valores de UX previstos:
- `Salvando` — gravando cache/arquivo local ou enviando lote;
- `Salvo` — gravação local confirmada;
- `Pendente` — salvo localmente, aguardando rede/autenticação;
- `Sincronizado` — confirmado no banco central;
- `Falha ao sincronizar` — dados continuam locais e a operação entra em retry.

## Regra de conflito

Tentativas concluídas são imutáveis por `attempt_id`; reenvio é idempotente. Rascunhos e estados mutáveis usam `client_updated_at` e nunca apagam uma versão local mais nova silenciosamente.
