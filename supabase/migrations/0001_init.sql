-- Projects table
create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null check (length(name) between 1 and 200),
  data            jsonb not null,
  template_source text not null default 'default'
                    check (template_source in ('default', 'imported')),
  raw_html_path   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index projects_user_id_updated_at_idx
  on public.projects (user_id, updated_at desc);

-- updated_at trigger
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.tg_set_updated_at();

-- RLS
alter table public.projects enable row level security;

create policy "projects_select_own" on public.projects
  for select to authenticated
  using (auth.uid() = user_id);

create policy "projects_insert_own" on public.projects
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "projects_update_own" on public.projects
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "projects_delete_own" on public.projects
  for delete to authenticated
  using (auth.uid() = user_id);
