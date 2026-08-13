# Sincronização privada TDAS — Cargo 202

## Objetivo

Preservar o histórico pessoal de execução do Cargo 202 entre navegadores e dispositivos sem transformar a nuvem em fonte oficial do concurso.

## Hierarquia de dados

1. **Notion:** planejamento e registros oficiais do estudo.
2. **GitHub `main`:** contrato técnico, snapshots e validações.
3. **Armazenamento local:** execução offline e estado corrente do navegador.
4. **Supabase:** persistência privada opcional dos eventos pessoais de execução.

A sincronização privada não altera Notion, gabarito, edital, catálogo ou conclusão oficial de PE.

## Segurança

- tabela exclusiva: `public.tdas_202_events`;
- RLS habilitado;
- `anon` sem acesso à tabela;
- `authenticated` somente com `SELECT` e `INSERT` do próprio `auth.uid()`;
- cliente público usa somente chave publishable;
- nenhuma chave `service_role` ou secret pode existir no frontend;
- histórico remoto é append-only: o cliente não recebe `UPDATE` ou `DELETE`;
- Cargo 400/EDAS e tabelas do projeto Mychael não são reutilizados.

## Coleções sincronizadas na v1

- `attempts`;
- `errors`;
- `marked`;
- `reviews`;
- `aiQueue`;
- `dailyExecution`.

Rascunho ativo e causas locais de erro ficam fora da v1.

## Conflitos entre dispositivos

Cada versão de um registro vira um evento determinístico com `event_id`, `record_id`, `logical_clock`, payload e dispositivo de origem. A consolidação escolhe a versão mais nova por relógio lógico; empate é resolvido de forma determinística pelo ID do evento.

Isso permite união de históricos sem substituir o estado inteiro de um aparelho pelo de outro. Exclusão local não produz evento destrutivo e, portanto, não apaga silenciosamente o histórico remoto.

## Operação

A v1 é manual: o usuário autentica e executa **Sincronizar agora**. O site continua funcional offline e sem autenticação. Automação após conclusão de sessão só deve ser habilitada depois de validação em uso real.

## PWA

Os módulos locais da sincronização podem fazer parte do precache. A biblioteca externa do Supabase não deve ser pré-carregada: a sincronização remota é dependente de rede, enquanto o núcleo local, backup e estudo continuam offline.
