create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null default '',
  avatar text not null default '',
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (key in ('cart', 'wish', 'promo')),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists public.orders (
  id text primary key,
  user_id uuid not null references auth.users (id),
  status text not null default 'Pending'
    check (status in ('Pending', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled')),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  text text not null check (char_length(text) between 10 and 500),
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index if not exists reviews_product_created_idx on public.reviews (product_id, created_at desc);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id),
  text text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists conversation_messages_created_idx
  on public.conversation_messages (conversation_id, created_at);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.owner_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists owner_notifications_unread_idx
  on public.owner_notifications (created_at desc) where read_at is null;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email, updated_at = pg_catalog.now();
  return new;
end;
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
    and (select auth.uid()) = old.id
    and new.role is distinct from old.role then
    raise exception 'Profile roles can only be changed by a store administrator.';
  end if;
  return new;
end;
$$;

create or replace function public.create_order(order_data jsonb)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_profile public.profiles%rowtype;
  item jsonb;
  product_data jsonb;
  product_id text;
  quantity integer;
  product_price numeric;
  order_id text;
  created_order public.orders%rowtype;
begin
  if caller_id is null then
    raise exception 'Sign in before placing an order.';
  end if;

  select * into caller_profile from public.profiles where id = caller_id;
  if caller_profile.id is null or caller_profile.role = 'admin' then
    raise exception 'A customer account is required to place an order.';
  end if;
  if pg_catalog.jsonb_typeof(order_data -> 'items') <> 'array'
    or pg_catalog.jsonb_array_length(order_data -> 'items') = 0 then
    raise exception 'An order must include at least one item.';
  end if;

  order_id := order_data ->> 'id';
  if order_id is null or pg_catalog.length(order_id) > 80 then
    raise exception 'Invalid order identifier.';
  end if;

  for item in select value from pg_catalog.jsonb_array_elements(order_data -> 'items')
  loop
    product_id := item ->> 'pid';
    if product_id is null or product_id = '' then
      continue;
    end if;
    quantity := (item ->> 'qty')::integer;
    if quantity < 1 then
      raise exception 'Invalid product quantity.';
    end if;

    select data into product_data from public.products where id = product_id for update;
    if product_data is null then
      raise exception 'A product in your cart is no longer available.';
    end if;
    if (product_data ->> 'stock')::integer < quantity then
      raise exception 'Not enough stock for %.', product_data ->> 'name';
    end if;
    product_price := (product_data ->> 'price')::numeric;
    if (item ->> 'price')::numeric is distinct from product_price then
      raise exception 'The price for % has changed. Refresh your cart.', product_data ->> 'name';
    end if;

    update public.products
    set data = pg_catalog.jsonb_set(data, '{stock}', pg_catalog.to_jsonb((data ->> 'stock')::integer - quantity)),
        updated_at = pg_catalog.now()
    where id = product_id;
  end loop;

  insert into public.orders (id, user_id, status, data)
  values (
    order_id,
    caller_id,
    'Pending',
    order_data || pg_catalog.jsonb_build_object(
      'user', caller_profile.email,
      'customer', caller_profile.name,
      'status', 'Pending'
    )
  )
  returning * into created_order;
  return created_order;
end;
$$;

create or replace function public.cancel_order(target_order_id text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  cancelled_order public.orders%rowtype;
  item jsonb;
  product_id text;
  quantity integer;
begin
  if caller_id is null then
    raise exception 'Sign in before cancelling an order.';
  end if;

  update public.orders
  set status = 'Cancelled',
      data = pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(data, '{status}', '"Cancelled"'::jsonb),
        '{cancelledAt}',
        pg_catalog.to_jsonb(pg_catalog.now())
      ),
      updated_at = pg_catalog.now()
  where id = target_order_id
    and user_id = caller_id
    and status = 'Pending'
  returning * into cancelled_order;

  if cancelled_order.id is null then
    raise exception 'Only your pending orders can be cancelled.';
  end if;

  for item in select value from pg_catalog.jsonb_array_elements(cancelled_order.data -> 'items')
  loop
    product_id := item ->> 'pid';
    if product_id is null or product_id = '' then continue; end if;
    quantity := (item ->> 'qty')::integer;
    update public.products
    set data = pg_catalog.jsonb_set(data, '{stock}', pg_catalog.to_jsonb((data ->> 'stock')::integer + quantity)),
        updated_at = pg_catalog.now()
    where id = product_id;
  end loop;

  return cancelled_order;
end;
$$;

create or replace function public.record_conversation_message(target_conversation uuid, message_text text)
returns public.conversation_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  saved_message public.conversation_messages%rowtype;
begin
  if caller_id is null
    or not exists (
      select 1 from public.conversations c
      where c.id = target_conversation
        and (c.customer_id = caller_id or public.is_store_admin())
    ) then
    raise exception 'This conversation is not available to your account.';
  end if;

  insert into public.conversation_messages (conversation_id, sender_id, text)
  values (target_conversation, caller_id, pg_catalog.btrim(message_text))
  returning * into saved_message;

  update public.conversations set updated_at = pg_catalog.now() where id = target_conversation;
  return saved_message;
end;
$$;

create or replace function public.notify_store_owner_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.owner_notifications (order_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists auth_user_profile_created on auth.users;
create trigger auth_user_profile_created
after insert or update of email on auth.users
for each row execute function public.create_profile_for_auth_user();

insert into public.profiles (id, email, name)
select id, email,
  coalesce(nullif(raw_user_meta_data ->> 'name', ''), pg_catalog.split_part(email, '@', 1))
from auth.users
where email is not null
on conflict (id) do nothing;

drop trigger if exists profile_role_protected on public.profiles;
create trigger profile_role_protected
before update on public.profiles
for each row execute function public.protect_profile_role();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at before update on public.products
for each row execute function public.touch_updated_at();

drop trigger if exists preferences_touch_updated_at on public.user_preferences;
create trigger preferences_touch_updated_at before update on public.user_preferences
for each row execute function public.touch_updated_at();

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at before update on public.orders
for each row execute function public.touch_updated_at();

drop trigger if exists conversation_touch_updated_at on public.conversations;
create trigger conversation_touch_updated_at before update on public.conversations
for each row execute function public.touch_updated_at();

drop trigger if exists order_owner_notification_created on public.orders;
create trigger order_owner_notification_created after insert on public.orders
for each row execute function public.notify_store_owner_new_order();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.user_preferences enable row level security;
alter table public.orders enable row level security;
alter table public.reviews enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.contact_messages enable row level security;
alter table public.owner_notifications enable row level security;

drop policy if exists "Profiles are readable by their owner or store admin" on public.profiles;
create policy "Profiles are readable by their owner or store admin"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select public.is_store_admin()));

drop policy if exists "Customers update their own profile" on public.profiles;
create policy "Customers update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Products are publicly readable" on public.products;
create policy "Products are publicly readable"
on public.products for select to anon, authenticated using (true);

drop policy if exists "Store admins manage products" on public.products;
create policy "Store admins manage products"
on public.products for all to authenticated
using ((select public.is_store_admin()))
with check ((select public.is_store_admin()));

drop policy if exists "Customers manage their own preferences" on public.user_preferences;
create policy "Customers manage their own preferences"
on public.user_preferences for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Customers and admins read orders" on public.orders;
create policy "Customers and admins read orders"
on public.orders for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_store_admin()));

drop policy if exists "Store admins update orders" on public.orders;
create policy "Store admins update orders"
on public.orders for update to authenticated
using ((select public.is_store_admin()))
with check ((select public.is_store_admin()));

drop policy if exists "Product reviews are publicly readable" on public.reviews;
create policy "Product reviews are publicly readable"
on public.reviews for select to anon, authenticated using (true);

drop policy if exists "Customers create their own reviews" on public.reviews;
create policy "Customers create their own reviews"
on public.reviews for insert to authenticated
with check ((select auth.uid()) = user_id and not (select public.is_store_admin()));

drop policy if exists "Customers update their own reviews" on public.reviews;
create policy "Customers update their own reviews"
on public.reviews for update to authenticated
using ((select auth.uid()) = user_id and not (select public.is_store_admin()))
with check ((select auth.uid()) = user_id and not (select public.is_store_admin()));

drop policy if exists "Customers delete their own reviews" on public.reviews;
create policy "Customers delete their own reviews"
on public.reviews for delete to authenticated
using ((select auth.uid()) = user_id and not (select public.is_store_admin()));

drop policy if exists "Customers create their conversation" on public.conversations;
create policy "Customers create their conversation"
on public.conversations for insert to authenticated
with check ((select auth.uid()) = customer_id and not (select public.is_store_admin()));

drop policy if exists "Conversation access is limited to its customer and admins" on public.conversations;
create policy "Conversation access is limited to its customer and admins"
on public.conversations for select to authenticated
using ((select auth.uid()) = customer_id or (select public.is_store_admin()));

drop policy if exists "Conversation messages are readable by participants" on public.conversation_messages;
create policy "Conversation messages are readable by participants"
on public.conversation_messages for select to authenticated
using (exists (
  select 1 from public.conversations c
  where c.id = conversation_id
    and (c.customer_id = (select auth.uid()) or (select public.is_store_admin()))
));

drop policy if exists "Participants send messages as themselves" on public.conversation_messages;
create policy "Participants send messages as themselves"
on public.conversation_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.customer_id = (select auth.uid()) or (select public.is_store_admin()))
  )
);

drop policy if exists "Visitors send contact messages" on public.contact_messages;
create policy "Visitors send contact messages"
on public.contact_messages for insert to anon, authenticated
with check (true);

drop policy if exists "Store admins read contact messages" on public.contact_messages;
create policy "Store admins read contact messages"
on public.contact_messages for select to authenticated
using ((select public.is_store_admin()));

drop policy if exists "Store admins manage order notifications" on public.owner_notifications;
create policy "Store admins manage order notifications"
on public.owner_notifications for all to authenticated
using ((select public.is_store_admin()))
with check ((select public.is_store_admin()));

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'profiles', 'products', 'user_preferences', 'orders', 'reviews', 'conversations',
      'conversation_messages', 'contact_messages', 'owner_notifications'
    ]
    loop
      if not exists (
        select 1 from pg_catalog.pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename::text = table_name
      ) then
        execute pg_catalog.format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;

grant select on public.products to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant select, insert on public.conversations to authenticated;
grant select, insert on public.conversation_messages to authenticated;
grant insert on public.contact_messages to anon, authenticated;
grant select on public.contact_messages to authenticated;
grant select, update on public.owner_notifications to authenticated;

revoke all on function public.create_order(jsonb) from public;
revoke all on function public.cancel_order(text) from public;
revoke all on function public.record_conversation_message(uuid, text) from public;
grant execute on function public.create_order(jsonb) to authenticated;
grant execute on function public.cancel_order(text) to authenticated;
grant execute on function public.record_conversation_message(uuid, text) to authenticated;
