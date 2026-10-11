-- RLS di semua tabel + RPC atomik. Klien tidak pernah menulis langsung ke
-- keanggotaan, undangan, pembayaran, atau buku kas.

-- created_by otomatis dari sesi
do $$
declare t text;
begin
  foreach t in array array['weddings','deposits','fund_withdrawals','vendors','budget_items',
                           'payments','prep_tasks','guests','cash_flow_entries','wedding_invitations']
  loop
    execute format('alter table public.%I alter column created_by set default auth.uid()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Helper keanggotaan (SECURITY DEFINER agar tidak rekursif di RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_member(p_wedding uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.wedding_members m
                 where m.wedding_id = p_wedding and m.user_id = auth.uid());
$$;

create or replace function public.is_owner(p_wedding uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.wedding_members m
                 where m.wedding_id = p_wedding and m.user_id = auth.uid() and m.role = 'owner');
$$;

revoke all on function public.is_member(uuid), public.is_owner(uuid) from public;
grant execute on function public.is_member(uuid), public.is_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.weddings            enable row level security;
alter table public.wedding_members     enable row level security;
alter table public.wedding_invitations enable row level security;
alter table public.deposits            enable row level security;
alter table public.fund_withdrawals    enable row level security;
alter table public.vendors             enable row level security;
alter table public.budget_items        enable row level security;
alter table public.payments            enable row level security;
alter table public.cash_flow_entries   enable row level security;
alter table public.prep_tasks          enable row level security;
alter table public.guests              enable row level security;

revoke all on all tables in schema public from anon, authenticated;

-- weddings: baca & ubah oleh anggota; buat lewat RPC
grant select, update on public.weddings to authenticated;
create policy weddings_select on public.weddings for select to authenticated using (public.is_member(id));
create policy weddings_update on public.weddings for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));

-- keanggotaan & undangan: hanya baca
grant select on public.wedding_members to authenticated;
create policy members_select on public.wedding_members for select to authenticated
  using (public.is_member(wedding_id));
grant select (id, wedding_id, expires_at, created_at, redeemed_at) on public.wedding_invitations to authenticated;
create policy invitations_select on public.wedding_invitations for select to authenticated
  using (public.is_owner(wedding_id));

-- pembayaran & buku kas: hanya baca (tulis lewat RPC)
grant select on public.payments, public.cash_flow_entries to authenticated;
create policy payments_select on public.payments for select to authenticated using (public.is_member(wedding_id));
create policy cashflow_select on public.cash_flow_entries for select to authenticated using (public.is_member(wedding_id));

-- tabel data biasa: anggota boleh baca/tambah/ubah
do $$
declare t text;
begin
  foreach t in array array['deposits','fund_withdrawals','vendors','budget_items','prep_tasks','guests']
  loop
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(wedding_id))', t||'_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_member(wedding_id) and created_by = auth.uid())', t||'_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_member(wedding_id)) with check (public.is_member(wedding_id))', t||'_update', t);
  end loop;
  -- hapus keras hanya untuk data non-keuangan
  foreach t in array array['vendors','prep_tasks','guests']
  loop
    execute format('grant delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_member(wedding_id))', t||'_delete', t);
  end loop;
end $$;

-- Pembatalan hanya lewat cancel_record (teraudit): kolom cancelled_* tidak bisa diubah langsung.
revoke update on public.deposits, public.fund_withdrawals, public.budget_items from authenticated;
grant update (contributor, amount, deposited_on, note, revision) on public.deposits to authenticated;
grant update (amount, withdrawn_on, note, revision) on public.fund_withdrawals to authenticated;
grant update (section, category, name, vendor_id, estimated_price, final_price, due_date, notes, revision)
  on public.budget_items to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: wedding & undangan
-- ---------------------------------------------------------------------------
create or replace function public.create_wedding(
  p_groom text, p_bride text, p_date date default null, p_location text default null,
  p_target bigint default null, p_opening bigint default 0, p_budget_cap bigint default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if exists (select 1 from public.wedding_members where user_id = v_uid) then
    raise exception 'already_in_wedding' using errcode = 'P0001';   -- v1: satu wedding per akun
  end if;
  insert into public.weddings (groom_name, bride_name, wedding_date, location, target_amount,
                               opening_balance, budget_cap, created_by)
  values (p_groom, p_bride, p_date, p_location, p_target, coalesce(p_opening, 0), p_budget_cap, v_uid)
  returning id into v_id;
  insert into public.wedding_members (wedding_id, user_id, role) values (v_id, v_uid, 'owner');
  return v_id;
end $$;

create or replace function public.create_invitation(p_wedding uuid) returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_code text;
begin
  if not public.is_owner(p_wedding) then raise exception 'forbidden' using errcode = '42501'; end if;
  if (select count(*) from public.wedding_members where wedding_id = p_wedding) >= 2 then
    raise exception 'member_limit_reached' using errcode = 'P0001';
  end if;
  -- kode lama yang belum dipakai dibuat kedaluwarsa
  update public.wedding_invitations set expires_at = now()
   where wedding_id = p_wedding and redeemed_at is null and expires_at > now();
  v_code := upper(substr(translate(encode(gen_random_bytes(9), 'base64'), '+/=Il1O0', 'XYZABCD'), 1, 10));
  insert into public.wedding_invitations (wedding_id, code_hash, expires_at, created_by)
  values (p_wedding, digest(v_code, 'sha256'), now() + interval '7 days', auth.uid());
  return v_code;
end $$;

create or replace function public.redeem_invitation(p_code text) returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_uid uuid := auth.uid(); v_inv public.wedding_invitations;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v_inv from public.wedding_invitations
   where code_hash = digest(upper(btrim(coalesce(p_code, ''))), 'sha256')
     and redeemed_at is null and expires_at > now()
   for update;
  if not found then raise exception 'invalid_invitation' using errcode = 'P0001'; end if;
  if exists (select 1 from public.wedding_members where user_id = v_uid) then
    raise exception 'already_in_wedding' using errcode = 'P0001';
  end if;
  insert into public.wedding_members (wedding_id, user_id, role) values (v_inv.wedding_id, v_uid, 'partner');
  update public.wedding_invitations set redeemed_by = v_uid, redeemed_at = now() where id = v_inv.id;
  return v_inv.wedding_id;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: pembayaran (idempoten, atomik)
-- ---------------------------------------------------------------------------
create or replace function public.record_payment(
  p_wedding uuid, p_request_id uuid, p_item uuid, p_type text, p_amount bigint, p_paid_on date,
  p_funding text default 'wedding_fund', p_parent uuid default null, p_note text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_existing public.payments; v_parent public.payments; v_id uuid; v_item public.budget_items;
  v_refunded bigint; v_funding text := p_funding;
begin
  if not public.is_member(p_wedding) then raise exception 'forbidden' using errcode = '42501'; end if;

  -- idempotensi: request_id yang sama mengembalikan hasil yang sama
  select * into v_existing from public.payments where wedding_id = p_wedding and request_id = p_request_id;
  if found then
    if v_existing.budget_item_id <> p_item or v_existing.amount <> p_amount or v_existing.type <> p_type then
      raise exception 'request_id_reused' using errcode = 'P0001';
    end if;
    return v_existing.id;
  end if;

  select * into v_item from public.budget_items
   where wedding_id = p_wedding and id = p_item and cancelled_at is null for share;
  if not found then raise exception 'item_not_found' using errcode = 'P0002'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount' using errcode = '22023'; end if;

  if p_type = 'refund' then
    select * into v_parent from public.payments
     where wedding_id = p_wedding and id = p_parent and cancelled_at is null for update;
    if not found or v_parent.type <> 'payment' or v_parent.budget_item_id <> p_item then
      raise exception 'invalid_parent' using errcode = 'P0001';
    end if;
    select coalesce(sum(amount), 0) into v_refunded from public.payments
     where wedding_id = p_wedding and parent_payment_id = p_parent and cancelled_at is null;
    if v_refunded + p_amount > v_parent.amount then
      raise exception 'refund_exceeds_payment' using errcode = 'P0001';
    end if;
    v_funding := v_parent.funding_source;
  elsif p_type = 'payment' then
    if p_parent is not null then raise exception 'invalid_parent' using errcode = 'P0001'; end if;
  else
    raise exception 'invalid_type' using errcode = '22023';
  end if;

  insert into public.payments (wedding_id, budget_item_id, request_id, type, parent_payment_id, amount,
                               paid_on, funding_source, note, created_by)
  values (p_wedding, p_item, p_request_id, p_type, p_parent, p_amount, p_paid_on, v_funding, p_note, auth.uid())
  returning id into v_id;

  -- buku kas: pembayaran dari dana pernikahan keluar seketika; refund masuk baru saat diterima
  if v_funding = 'wedding_fund' and p_type = 'payment' then
    insert into public.cash_flow_entries (wedding_id, payment_id, signed_amount, created_by)
    values (p_wedding, v_id, -p_amount, auth.uid());
  end if;
  return v_id;
end $$;

create or replace function public.mark_refund_received(p_wedding uuid, p_payment uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_p public.payments;
begin
  if not public.is_member(p_wedding) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_p from public.payments
   where wedding_id = p_wedding and id = p_payment and type = 'refund' and cancelled_at is null for update;
  if not found then raise exception 'invalid_refund' using errcode = 'P0002'; end if;
  if v_p.refund_received then return; end if;   -- idempoten
  update public.payments set refund_received = true where id = v_p.id;
  if v_p.funding_source = 'wedding_fund' then
    insert into public.cash_flow_entries (wedding_id, payment_id, signed_amount, created_by)
    values (p_wedding, v_p.id, v_p.amount, auth.uid());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: pembatalan teraudit (tidak ada hapus keras)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_record(p_wedding uuid, p_kind text, p_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_table text; v_n int;
begin
  if not public.is_member(p_wedding) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  v_table := case p_kind
    when 'deposit' then 'deposits' when 'withdrawal' then 'fund_withdrawals'
    when 'payment' then 'payments' when 'budget_item' then 'budget_items' end;
  if v_table is null then raise exception 'invalid_kind' using errcode = '22023'; end if;

  if p_kind = 'payment' and exists (select 1 from public.payments
       where wedding_id = p_wedding and parent_payment_id = p_id and cancelled_at is null) then
    raise exception 'has_active_refunds' using errcode = 'P0001';
  end if;
  if p_kind = 'budget_item' and exists (select 1 from public.payments
       where wedding_id = p_wedding and budget_item_id = p_id and cancelled_at is null) then
    raise exception 'has_active_payments' using errcode = 'P0001';
  end if;

  execute format('update public.%I set cancelled_at = now(), cancelled_by = %L, cancel_reason = %L
                   where wedding_id = %L and id = %L and cancelled_at is null',
                 v_table, auth.uid(), btrim(p_reason), p_wedding, p_id);
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'not_found_or_already_cancelled' using errcode = 'P0002'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Ringkasan keuangan
-- ---------------------------------------------------------------------------
create view public.budget_item_status with (security_invoker = true) as
select
  b.wedding_id, b.id as budget_item_id, b.section, b.category, b.name, b.vendor_id, b.due_date,
  b.estimated_price, b.final_price,
  coalesce(b.final_price, b.estimated_price)                       as committed_price,
  coalesce(p.net_paid, 0)::bigint                                  as paid_amount,
  (coalesce(b.final_price, b.estimated_price) - coalesce(p.net_paid, 0))::bigint as remaining,
  case
    when coalesce(p.net_paid, 0) = 0 then 'belum_dibayar'
    when coalesce(b.final_price, b.estimated_price) is null then 'dp'
    when p.net_paid > coalesce(b.final_price, b.estimated_price) then 'kelebihan_bayar'
    when p.net_paid = coalesce(b.final_price, b.estimated_price) then 'lunas'
    else 'dp'
  end as status
from public.budget_items b
left join lateral (
  select sum(case when pay.type = 'payment' then pay.amount else -pay.amount end) as net_paid
  from public.payments pay
  where pay.wedding_id = b.wedding_id and pay.budget_item_id = b.id and pay.cancelled_at is null
) p on true
where b.cancelled_at is null;

create or replace function public.finance_summary(p_wedding uuid)
returns table (
  collected bigint, target bigint, funding_progress numeric, available_balance bigint,
  total_committed bigint, total_paid bigint, outstanding bigint, plan_remaining bigint
)
language sql stable security invoker set search_path = public, pg_temp as $$
  with w as (select * from public.weddings where id = p_wedding),
  dep as (select coalesce(sum(amount), 0) s from public.deposits where wedding_id = p_wedding and cancelled_at is null),
  wd  as (select coalesce(sum(amount), 0) s from public.fund_withdrawals where wedding_id = p_wedding and cancelled_at is null),
  cf  as (select coalesce(sum(c.signed_amount), 0) s
            from public.cash_flow_entries c
            join public.payments p on p.wedding_id = c.wedding_id and p.id = c.payment_id
           where c.wedding_id = p_wedding and p.cancelled_at is null),
  it  as (select coalesce(sum(committed_price), 0) committed, coalesce(sum(paid_amount), 0) paid
            from public.budget_item_status where wedding_id = p_wedding)
  select
    (w.opening_balance + dep.s)::bigint,
    w.target_amount,
    case when coalesce(w.target_amount, 0) > 0 then (w.opening_balance + dep.s)::numeric / w.target_amount end,
    (w.opening_balance + dep.s - wd.s + cf.s)::bigint,
    it.committed::bigint,
    it.paid::bigint,
    (it.committed - it.paid)::bigint,
    case when w.budget_cap is not null then (w.budget_cap - it.committed)::bigint end
  from w, dep, wd, cf, it;
$$;

grant select on public.budget_item_status to authenticated;

revoke all on function
  public.create_wedding(text, text, date, text, bigint, bigint, bigint),
  public.create_invitation(uuid), public.redeem_invitation(text),
  public.record_payment(uuid, uuid, uuid, text, bigint, date, text, uuid, text),
  public.mark_refund_received(uuid, uuid), public.cancel_record(uuid, text, uuid, text),
  public.finance_summary(uuid)
from public;
grant execute on function
  public.create_wedding(text, text, date, text, bigint, bigint, bigint),
  public.create_invitation(uuid), public.redeem_invitation(text),
  public.record_payment(uuid, uuid, uuid, text, bigint, date, text, uuid, text),
  public.mark_refund_received(uuid, uuid), public.cancel_record(uuid, text, uuid, text),
  public.finance_summary(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime (tersaring per wedding oleh RLS)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['deposits','fund_withdrawals','vendors','budget_items','payments',
                             'cash_flow_entries','prep_tasks','guests','weddings']
    loop
      execute format('alter publication supabase_realtime add table public.%I', t);
    end loop;
  end if;
end $$;
