# Operação dos gabaritos privados do TDAS 202

Este documento governa a retirada dos gabaritos do Cargo 202 do repositório e do GitHub Pages. O EDAS Cargo 400 permanece fora deste serviço e continua com sua governança própria.

## Arquitetura

O serviço usa dois Cloudflare Workers sobre o mesmo banco D1:

- `tdas-answer-key-auth`: única rota `/auth/session`; o Cloudflare Access protege todo este Worker. O Worker valida a assinatura e os claims do JWT do Access antes de emitir uma sessão curta.
- `tdas-answer-keys`: rotas `/v1/corrections`, `/v1/session/revoke` e `/healthz`; não usa cookie do Access. A API aceita somente um bearer token aleatório, armazena apenas seu SHA-256 no D1, exige a origem exata do GitHub Pages e nunca responde com cache público.

A separação é obrigatória. Proteger a API inteira com Access faria a correção depender de cookie entre `github.io` e `workers.dev`, comportamento que pode ser bloqueado no Safari/iPad. A API não possui rota pública de gabarito e o token curto não é um segredo estático do JavaScript.

O D1 contém apenas:

- a correção diária vigente;
- os 570 itens cujo cargo é exatamente `202` e `TDAS — Técnico Administrativo`;
- hashes de sessões com expiração e revogação.

Questões EDAS 400 e outros cargos não entram no namespace `tdas-cargo-202`.

## Estado de transição

Enquanto `data/integration/answer-key-service.json` estiver em `legacy-public`, o site continua usando as chaves públicas existentes. A infraestrutura privada pode ser testada sem mudar a experiência publicada.

Os arquivos públicos só podem ser apagados em uma PR posterior quando todos estes pontos estiverem comprovados:

1. os dois Workers foram implantados;
2. o D1 recebeu migrações e a carga completa;
3. o Access protege somente o Worker de autenticação e permite apenas a conta autorizada;
4. o smoke autenticado funcionou em celular, iPad/Safari e desktop;
5. uma solicitação sem sessão recebeu `401` e uma origem indevida recebeu `403`;
6. o cliente foi alterado para `mode: private`, `publicFallbackAllowed: false` e URLs HTTPS distintas;
7. a sincronização atualiza o D1 sem recriar chaves dentro do artefato público;
8. o rollback foi testado antes da remoção.

## Preparação e carga

O operador autenticado cria o D1 `tdas-answer-keys`, aplica `workers/answer-key/migrations` e injeta o `database_id` nos dois arquivos de configuração usados no deploy. Nenhum token da Cloudflare deve ser salvo no repositório.

A carga inicial é gerada fora de `data/`:

```sh
node scripts/answer-key-private-store.mjs --source public --output .private/answer-keys.sql
```

O SQL substitui atomicamente o namespace TDAS 202, removendo conjuntos obsoletos, e não altera sessões. A carga precisa informar 36 conjuntos e 630 respostas no snapshot atual: 570 do Banco Mestre e 60 do PE101. Esses números são gates do snapshot atual, não constantes permanentes do produto.

Antes do deploy, execute:

```sh
npm ci --prefix workers/answer-key
npm run check --prefix workers/answer-key
npm run test:answer-key-client
npm run test:answer-key-private-store
```

## Cloudflare Access

Crie uma aplicação Access do tipo self-hosted para a URL do Worker `tdas-answer-key-auth`. A política deve permitir somente a identidade do titular e negar os demais usuários. Não proteja `tdas-answer-keys` com Access; a API já é fechada pela sessão curta emitida pelo Worker autenticado.

Configure no Worker de autenticação:

- `ACCESS_TEAM_DOMAIN`: domínio HTTPS `*.cloudflareaccess.com` da conta;
- `ACCESS_AUD`: audience da aplicação Access;
- `SESSION_TTL_SECONDS`: 1200 por padrão.

`ACCESS_TEAM_DOMAIN` e `ACCESS_AUD` identificam o emissor e a aplicação, mas não substituem autenticação. O Worker valida JWKS, algoritmo RS256, `kid`, emissor, audience, tipo, expiração e assinatura.

## Corte e validação

O corte deve ocorrer em uma PR separada:

1. preencher `apiBaseUrl` e `authBaseUrl` com origens HTTPS diferentes;
2. mudar o modo para `private` e desativar `publicFallbackAllowed`;
3. validar que a correção só solicita autorização depois de todas as respostas estarem fechadas;
4. publicar e executar smoke autenticado nas três classes de dispositivo;
5. retirar os arquivos TDAS 202 do repositório e do gerador;
6. renovar a versão do service worker para apagar cópias antigas dos caches;
7. verificar por URL que cada chave antiga responde `404`;
8. confirmar que o EDAS e os demais cargos continuam isolados.

O service worker nunca inclui gabaritos no precache. Respostas privadas usam `Cache-Control: no-store`; depois da finalização ficam apenas na memória da página. Recarregar offline não revela nem recupera a chave.

## Revogação, rotação e recuperação

- Revogação individual: chamar `/v1/session/revoke`; o token deixa de funcionar imediatamente.
- Revogação total: remover as linhas de `access_sessions` no D1. Nenhum gabarito precisa ser reimportado.
- Rotação de acesso: alterar a política/audience no Cloudflare Access e atualizar `ACCESS_AUD`; sessões já emitidas podem ser revogadas no D1.
- Rotação do banco: gerar nova carga e importá-la; a transação substitui o namespace inteiro e não deixa conjuntos antigos ativos.
- Falha da API: não reativar fallback público. Manter o rascunho local e mostrar indisponibilidade de correção.
- Rollback antes da remoção pública: voltar o arquivo de configuração para `legacy-public`.
- Recuperação depois da remoção pública: restaurar o último snapshot privado validado no D1 e reimplantar os Workers. Não recolocar as chaves no GitHub Pages.

Logs não podem incluir JWT do Access, bearer token, respostas do gabarito ou dados pessoais. O monitor pode registrar somente status, namespace, contagem e códigos de erro.
