create table if not exists public.tdas_202_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  collection text not null,
  record_id text not null,
  logical_clock bigint not null check (logical_clock >= 0),
  payload jsonb not null,
  source_device_id text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id),
  constraint tdas_202_events_collection check (collection in ('attempts','errors','marked','reviews','aiQueue','dailyExecution'))
);

create index if not exists tdas_202_events_user_clock_idx
  on public.tdas_202_events (user_id, logical_clock desc);
create index if not exists tdas_202_events_record_idx
  on public.tdas_202_events (user_id, collection, record_id, logical_clock desc);

alter table public.tdas_202_events enable row level security;
revoke all on table public.tdas_202_events from anon;
revoke all on table public.tdas_202_events from authenticated;
grant select, insert on table public.tdas_202_events to authenticated;
grant all on table public.tdas_202_events to service_role;

drop policy if exists tdas_202_events_select_own on public.tdas_202_events;
create policy tdas_202_events_select_own
on public.tdas_202_events for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists tdas_202_events_insert_own on public.tdas_202_events;
create policy tdas_202_events_insert_own
on public.tdas_202_events for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
