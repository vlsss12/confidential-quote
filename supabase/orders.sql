create table if not exists public.confidential_quote_demo_orders (
  id uuid primary key,
  sku text not null check (sku = 'loyalty-item'),
  quantity smallint not null check (quantity between 1 and 3),
  profile text not null check (profile in ('standard', 'rewards')),
  total_cents integer not null check (total_cents > 0),
  created_at timestamptz not null default now(),
  status text not null default 'demo_order' check (status = 'demo_order')
);

alter table public.confidential_quote_demo_orders enable row level security;
revoke all on public.confidential_quote_demo_orders from anon, authenticated;

create or replace function public.create_confidential_quote_demo_order(
  p_order_id uuid,
  p_sku text,
  p_quantity integer,
  p_profile text,
  p_total_cents integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_cents integer;
  result_row public.confidential_quote_demo_orders%rowtype;
begin
  if p_sku <> 'loyalty-item' or p_quantity not between 1 and 3 or
     p_profile not in ('standard', 'rewards') then
    raise exception 'invalid demo order';
  end if;
  expected_cents := (5 * p_quantity - case when p_profile = 'rewards' then 2 else 0 end) * 100;
  if p_total_cents <> expected_cents then
    raise exception 'invalid demo quote';
  end if;

  insert into public.confidential_quote_demo_orders(id, sku, quantity, profile, total_cents)
  values (p_order_id, p_sku, p_quantity, p_profile, p_total_cents)
  on conflict (id) do nothing;

  select * into result_row from public.confidential_quote_demo_orders where id = p_order_id;
  return jsonb_build_object(
    'id', result_row.id,
    'sku', result_row.sku,
    'quantity', result_row.quantity,
    'profile', result_row.profile,
    'total_cents', result_row.total_cents,
    'created_at', result_row.created_at
  );
end;
$$;

revoke all on function public.create_confidential_quote_demo_order(uuid, text, integer, text, integer) from public, anon, authenticated;
grant execute on function public.create_confidential_quote_demo_order(uuid, text, integer, text, integer) to service_role;
