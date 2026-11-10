create table public.confidential_quote_saved_quotes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  quantity smallint not null check (quantity between 1 and 3),
  loyalty_tier smallint not null check (loyalty_tier between 0 and 3),
  total_cents integer not null check (total_cents in (300, 500, 800, 1000, 1300, 1500)),
  created_at timestamptz not null default now()
);

create index confidential_quote_saved_quotes_user_created_idx
  on public.confidential_quote_saved_quotes (user_id, created_at desc);

alter table public.confidential_quote_saved_quotes enable row level security;

revoke all on public.confidential_quote_saved_quotes from anon, authenticated;
grant select, delete on public.confidential_quote_saved_quotes to authenticated;
grant insert on public.confidential_quote_saved_quotes to service_role;

create policy "Users read only their saved quotes"
  on public.confidential_quote_saved_quotes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users delete only their saved quotes"
  on public.confidential_quote_saved_quotes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
