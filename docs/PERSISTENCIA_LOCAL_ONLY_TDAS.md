# Persistência TDAS — contrato local-only

Vigente a partir de 23/08/2026.

## Regra operacional

O TDAS não é mais a fonte de verdade do aproveitamento pessoal nem executa revisão interna. O fluxo oficial permanece Notion vivo → snapshot GitHub → site publicado para conteúdo, calendário e publicação.

Para dados pessoais do usuário:

- não há gravação ou leitura de tentativas, aproveitamento, erros, revisões ou rascunhos em Firebase/nuvem pessoal;
- uma bateria concluída pode exibir o resultado na tela, mas esse resultado é transitório e não cria novo histórico pessoal;
- D+1/D+7/D+20 não são gerados pelo player;
- o único estado de execução que deve continuar sendo salvo é o rascunho local de uma sessão ainda em andamento, para retomada no mesmo dispositivo;
- preferências da interface, metadados técnicos e cache do PWA podem continuar locais;
- dados pessoais legados já existentes não são apagados automaticamente e não devem ser reutilizados para novas sincronizações;
- a sincronização editorial do Notion/GitHub/Páginas não deve ser confundida com sincronização pessoal.

## Guardas

A rotina `preserve-private-history-pwa.mjs`, apesar do nome legado, funciona como guarda de remoção: impede que assets de Firebase/histórico privado e relatórios persistentes retornem ao precache após uma sincronização editorial.

O Resolver deve usar `local-only-result-policy.js`, não carregar `attempt-diagnostics.js` e não persistir a conclusão em `module-store.js`.

## Fora de escopo

A remoção destrutiva de dados legados já existentes em Firebase ou no navegador não faz parte desta migração. Qualquer exclusão definitiva exige uma decisão separada.
