# Correção de timeout do espelho do Notion

A sincronização operacional do TDAS e a geração do espelho completo do Notion passam a ser pipelines separados.

- `Sincronizar Plataforma TDAS v26` mantém o fluxo operacional dentro da janela de 35 minutos.
- `Publicar espelho completo do Notion` inicia apenas após sucesso da sincronização operacional e possui janela própria de 60 minutos.
- A publicação do espelho é bloqueada se `data/notion-mirror/index.json` permanecer em `bootstrap`, tiver uma única página ou nenhum banco.
- O snapshot é publicado somente quando houver mudança real e é rebaseado sobre a `main` mais recente antes do push.
- O token do Notion permanece exclusivamente no GitHub Actions.
