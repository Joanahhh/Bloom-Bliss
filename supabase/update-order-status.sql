create or replace function public.admin_update_order_status(target_order_id text, next_status text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_order public.orders%rowtype;
begin
  if (select auth.uid()) is null or not (select public.is_store_admin()) then
    raise exception 'Only a store administrator can update order status.';
  end if;
  if next_status not in ('Pending', 'Preparing', 'Out for Delivery', 'Delivered') then
    raise exception 'Invalid order status.';
  end if;

  update public.orders
  set status = next_status,
      data = pg_catalog.jsonb_set(data, '{status}', pg_catalog.to_jsonb(next_status), true),
      updated_at = pg_catalog.now()
  where id = target_order_id
    and status <> 'Cancelled'
  returning * into updated_order;

  if updated_order.id is null then
    raise exception 'Order not found or already cancelled.';
  end if;
  return updated_order;
end;
$$;

revoke all on function public.admin_update_order_status(text, text) from public;
grant execute on function public.admin_update_order_status(text, text) to authenticated;
