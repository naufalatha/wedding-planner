-- Ringkasan keuangan lebih lengkap, pergantian vendor terpilih atomik, kolom tambahan vendor/tamu.

alter table public.vendors add column package text;
alter table public.vendors add column link text;
alter table public.guests  add column email text;

drop function public.finance_summary(uuid);
create function public.finance_summary(p_wedding uuid)
returns table (
  collected bigint, target bigint, funding_progress numeric, available_balance bigint,
  total_estimated bigint, total_committed bigint, total_paid bigint, outstanding bigint,
  plan_remaining bigint, unpriced_count integer, estimate_based_count integer
)
language sql stable security invoker set search_path = public, pg_temp as $$
  with w as (select * from public.weddings where id = p_wedding),
  dep as (select coalesce(sum(amount), 0) s from public.deposits where wedding_id = p_wedding and cancelled_at is null),
  wd  as (select coalesce(sum(amount), 0) s from public.fund_withdrawals where wedding_id = p_wedding and cancelled_at is null),
  cf  as (select coalesce(sum(c.signed_amount), 0) s
            from public.cash_flow_entries c
            join public.payments p on p.wedding_id = c.wedding_id and p.id = c.payment_id
           where c.wedding_id = p_wedding and p.cancelled_at is null),
  it  as (select coalesce(sum(estimated_price), 0) est,
                 coalesce(sum(committed_price), 0) committed,
                 coalesce(sum(paid_amount), 0) paid,
                 count(*) filter (where committed_price is null)::int unpriced,
                 count(*) filter (where final_price is null and estimated_price is not null)::int est_based
            from public.budget_item_status where wedding_id = p_wedding)
  select
    (w.opening_balance + dep.s)::bigint,
    w.target_amount,
    case when coalesce(w.target_amount, 0) > 0 then (w.opening_balance + dep.s)::numeric / w.target_amount end,
    (w.opening_balance + dep.s - wd.s + cf.s)::bigint,
    it.est::bigint,
    it.committed::bigint,
    it.paid::bigint,
    (it.committed - it.paid)::bigint,
    case when w.budget_cap is not null then (w.budget_cap - it.committed)::bigint end,
    it.unpriced,
    it.est_based
  from w, dep, wd, cf, it;
$$;
revoke all on function public.finance_summary(uuid) from public;
grant execute on function public.finance_summary(uuid) to authenticated;

-- Memilih vendor: kandidat terpilih lama otomatis kembali jadi kandidat (riwayat tetap), dalam satu transaksi.
create function public.select_vendor(p_wedding uuid, p_vendor uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cat text;
begin
  if not public.is_member(p_wedding) then raise exception 'forbidden' using errcode = '42501'; end if;
  select category into v_cat from public.vendors
   where wedding_id = p_wedding and id = p_vendor and archived_at is null for update;
  if not found then raise exception 'vendor_not_found' using errcode = 'P0002'; end if;
  update public.vendors set status = 'candidate'
   where wedding_id = p_wedding and archived_at is null and status = 'selected'
     and lower(btrim(category)) = lower(btrim(v_cat)) and id <> p_vendor;
  update public.vendors set status = 'selected' where wedding_id = p_wedding and id = p_vendor;
end $$;
revoke all on function public.select_vendor(uuid, uuid) from public;
grant execute on function public.select_vendor(uuid, uuid) to authenticated;
