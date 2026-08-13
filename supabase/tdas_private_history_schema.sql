create table if not exists public.tdas_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id text not null,
  pe_id text,
  mode text not null check (mode in ('study','review','simulation','simulado','legacy')),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  elapsed_ms bigint not null default 0 check (elapsed_ms >= 0),
  active_elapsed_ms bigint check (active_elapsed_ms is null or active_elapsed_ms >= 0),
  total integer not null check (total >= 0),
  correct integer not null check (correct >= 0),
  incorrect integer not null check (incorrect >= 0),
  percent numeric(7,3) not null,
  revisit_count integer not null default 0 check (revisit_count >= 0),
  answer_change_count integer not null default 0 check (answer_change_count >= 0),
  device_id text,
  source text not null default 'browser',
  schema_version text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, attempt_id)
);

create table if not exists public.tdas_attempt_questions (
  user_id uuid not null,
  attempt_id text not null,
  question_id text not null,
  pe_id text,
  numero_original integer,
  materia text,
  assunto text,
  subassunto text,
  enunciado text,
  texto_base text,
  alternativas jsonb,
  selected text,
  correct_answer text,
  correct boolean not null,
  confidence text not null check (confidence in ('secure','doubt','guess')),
  marked boolean not null default false,
  classification text,
  issue text,
  active_ms bigint not null default 0 check (active_ms >= 0),
  visits integer not null default 0 check (visits >= 0),
  answer_changes integer not null default 0 check (answer_changes >= 0),
  first_answer text,
  last_answer text,
  first_answered_at timestamptz,
  last_answered_at timestamptz,
  answer_history jsonb,
  history_complete boolean not null default false,
  fundamento text,
  source jsonb,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, attempt_id, question_id),
  foreign key (user_id, attempt_id) references public.tdas_attempts(user_id, attempt_id) on delete cascade
);

create table if not exists public.tdas_session_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id text not null,
  pe_id text,
  catalog_id text,
  started_at timestamptz not null,
  client_updated_at timestamptz not null,
  device_id text,
  status text not null default 'active' check (status in ('active','completed','discarded')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, draft_id)
);

create table if not exists public.tdas_state_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null check (record_type in ('error','marked','review','aiQueue','errorCause','dailyProgress')),
  record_id text not null,
  device_id text,
  client_updated_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, record_type, record_id)
);

create index if not exists tdas_attempts_user_finished_idx on public.tdas_attempts(user_id, finished_at desc);
create index if not exists tdas_attempts_user_pe_idx on public.tdas_attempts(user_id, pe_id, finished_at desc);
create index if not exists tdas_questions_user_question_idx on public.tdas_attempt_questions(user_id, question_id);
create index if not exists tdas_drafts_user_updated_idx on public.tdas_session_drafts(user_id, client_updated_at desc);
create index if not exists tdas_state_user_type_idx on public.tdas_state_records(user_id, record_type, client_updated_at desc);

alter table public.tdas_attempts enable row level security;
alter table public.tdas_attempt_questions enable row level security;
alter table public.tdas_session_drafts enable row level security;
alter table public.tdas_state_records enable row level security;

revoke all on public.tdas_attempts from anon;
revoke all on public.tdas_attempt_questions from anon;
revoke all on public.tdas_session_drafts from anon;
revoke all on public.tdas_state_records from anon;

grant select, insert, update, delete on public.tdas_attempts to authenticated;
grant select, insert, update, delete on public.tdas_attempt_questions to authenticated;
grant select, insert, update, delete on public.tdas_session_drafts to authenticated;
grant select, insert, update, delete on public.tdas_state_records to authenticated;

drop policy if exists tdas_attempts_select_own on public.tdas_attempts;
create policy tdas_attempts_select_own on public.tdas_attempts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists tdas_attempts_insert_own on public.tdas_attempts;
create policy tdas_attempts_insert_own on public.tdas_attempts for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists tdas_attempts_update_own on public.tdas_attempts;
create policy tdas_attempts_update_own on public.tdas_attempts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists tdas_attempts_delete_own on public.tdas_attempts;
create policy tdas_attempts_delete_own on public.tdas_attempts for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists tdas_questions_select_own on public.tdas_attempt_questions;
create policy tdas_questions_select_own on public.tdas_attempt_questions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists tdas_questions_insert_own on public.tdas_attempt_questions;
create policy tdas_questions_insert_own on public.tdas_attempt_questions for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists tdas_questions_update_own on public.tdas_attempt_questions;
create policy tdas_questions_update_own on public.tdas_attempt_questions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists tdas_questions_delete_own on public.tdas_attempt_questions;
create policy tdas_questions_delete_own on public.tdas_attempt_questions for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists tdas_drafts_select_own on public.tdas_session_drafts;
create policy tdas_drafts_select_own on public.tdas_session_drafts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists tdas_drafts_insert_own on public.tdas_session_drafts;
create policy tdas_drafts_insert_own on public.tdas_session_drafts for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists tdas_drafts_update_own on public.tdas_session_drafts;
create policy tdas_drafts_update_own on public.tdas_session_drafts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists tdas_drafts_delete_own on public.tdas_session_drafts;
create policy tdas_drafts_delete_own on public.tdas_session_drafts for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists tdas_state_select_own on public.tdas_state_records;
create policy tdas_state_select_own on public.tdas_state_records for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists tdas_state_insert_own on public.tdas_state_records;
create policy tdas_state_insert_own on public.tdas_state_records for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists tdas_state_update_own on public.tdas_state_records;
create policy tdas_state_update_own on public.tdas_state_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists tdas_state_delete_own on public.tdas_state_records;
create policy tdas_state_delete_own on public.tdas_state_records for delete to authenticated using ((select auth.uid()) = user_id);
