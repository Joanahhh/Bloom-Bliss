create or replace function public.customer_confirm_order_received(target_order_id text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  confirmed_order public.orders%rowtype;
begin
  if caller_id is null or exists (
    select 1 from public.profiles
    where id = caller_id and role = 'admin'
  ) then
    raise exception 'Sign in with a customer account to confirm receipt.';
  end if;

  update public.orders
  set data = pg_catalog.jsonb_set(data, '{receivedAt}', pg_catalog.to_jsonb(pg_catalog.now()), true),
      updated_at = pg_catalog.now()
  where id = target_order_id
    and user_id = caller_id
    and status = 'Delivered'
    and not (data ? 'receivedAt')
  returning * into confirmed_order;

  if confirmed_order.id is not null then
    return confirmed_order;
  end if;

  select * into confirmed_order
  from public.orders
  where id = target_order_id and user_id = caller_id;

  if confirmed_order.id is not null
    and confirmed_order.status = 'Delivered'
    and confirmed_order.data ? 'receivedAt' then
    return confirmed_order;
  end if;

  raise exception 'Only your delivered orders can be confirmed as received.';
end;
$$;

revoke all on function public.customer_confirm_order_received(text) from public;
grant execute on function public.customer_confirm_order_received(text) to authenticated;
