-- Skema inti Wedding Planner. Semua tabel anak membawa wedding_id (siap multi-tenant).
-- Uang disimpan sebagai bigint rupiah utuh. NULL (kosong) berbeda dengan 0.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Trigger bersama: revisi + updated_at + kolom yang tidak boleh berubah
-- ---------------------------------------------------------------------------
create or replace function public.tg_touch_row() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.created_at is distinct from old.created_at
       or new.created_by is distinct from old.created_by then
      raise exception 'immutable_columns' using errcode = '42501';
    end if;
    if to_jsonb(new) ? 'wedding_id' and (to_jsonb(new)->>'wedding_id') is distinct from (to_jsonb(old)->>'wedding_id') then
      raise exception 'wedding_id_immutable' using errcode = '42501';
    end if;
    new.revision := old.revision + 1;
    new.updated_at := now();
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Wedding & keanggotaan
-- ---------------------------------------------------------------------------
create table public.weddings (
  id uuid primary key default gen_random_uuid(),
  groom_name text not null check (length(btrim(groom_name)) > 0),
  bride_name text not null check (length(btrim(bride_name)) > 0),
  wedding_date date,
  location text,
  target_amount bigint check (target_amount is null or target_amount >= 0),
  opening_balance bigint not null default 0 check (opening_balance >= 0),
  budget_cap bigint check (budget_cap is null or budget_cap >= 0),
  timezone text not null default 'Asia/Jakarta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null,
  revision integer not null default 1
);

create table public.wedding_members (
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner','partner')),
  created_at timestamptz not null default now(),
  primary key (wedding_id, user_id)
);
-- Tepat satu owner per wedding.
create unique index wedding_members_one_owner on public.wedding_members (wedding_id) where role = 'owner';

create or replace function public.tg_limit_members() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.wedding_members where wedding_id = new.wedding_id) >= 2 then
    raise exception 'member_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger limit_members before insert on public.wedding_members
  for each row execute function public.tg_limit_members();

create table public.wedding_invitations (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  code_hash bytea not null unique,           -- sha256 dari kode; kode asli tidak disimpan
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  redeemed_by uuid,
  redeemed_at timestamptz,
  check ((redeemed_by is null) = (redeemed_at is null))
);

-- ---------------------------------------------------------------------------
-- Keuangan
-- ---------------------------------------------------------------------------
create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  contributor text not null,
  amount bigint not null check (amount > 0),
  deposited_on date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null,
  revision integer not null default 1,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  unique (wedding_id, id)
);

create table public.fund_withdrawals (          -- penarikan dana pernikahan di luar pembayaran item
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  amount bigint not null check (amount > 0),
  withdrawn_on date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null,
  revision integer not null default 1,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  unique (wedding_id, id)
);

-- ---------------------------------------------------------------------------
-- Vendor
-- ---------------------------------------------------------------------------
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  category text not null check (length(btrim(category)) > 0),
  name text not null check (length(btrim(name)) > 0),
  status text not null default 'candidate' check (status in ('candidate','selected','rejected')),
  contact text,
  price_quote bigint check (price_quote is null or price_quote >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null,
  revision integer not null default 1,
  unique (wedding_id, id)
);
-- Satu vendor terpilih per kategori.
create unique index vendors_one_selected_per_category
  on public.vendors (wedding_id, lower(btrim(category))) where status = 'selected';

-- ---------------------------------------------------------------------------
-- Item anggaran & pembayaran
-- ---------------------------------------------------------------------------
create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  section text not null check (section in ('paperwork','seserahan','vendor','other')),
  category text,
  name text not null check (length(btrim(name)) > 0),
  vendor_id uuid,
  estimated_price bigint check (estimated_price is null or estimated_price >= 0),
  final_price bigint check (final_price is null or final_price >= 0),
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null,
  revision integer not null default 1,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  unique (wedding_id, id),
  foreign key (wedding_id, vendor_id) references public.vendors (wedding_id, id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  budget_item_id uuid not null,
  request_id uuid not null,                      -- idempotensi klien
  type text not null check (type in ('payment','refund')),
  parent_payment_id uuid,
  amount bigint not null check (amount > 0),
  paid_on date not null,
  funding_source text not null check (funding_source in ('wedding_fund','separate')),
  refund_received boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null,
  revision integer not null default 1,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  unique (wedding_id, id),
  unique (wedding_id, request_id),
  foreign key (wedding_id, budget_item_id) references public.budget_items (wedding_id, id),
  foreign key (wedding_id, parent_payment_id) references public.payments (wedding_id, id),
  check ((type = 'refund') = (parent_payment_id is not null)),
  check (type = 'refund' or refund_received = false)
);

create table public.cash_flow_entries (          -- buku kas dana pernikahan; satu entri per pembayaran
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  payment_id uuid not null,
  signed_amount bigint not null check (signed_amount <> 0),   -- negatif = keluar, positif = masuk
  created_at timestamptz not null default now(),
  created_by uuid not null,
  unique (payment_id),
  foreign key (wedding_id, payment_id) references public.payments (wedding_id, id)
);

-- ---------------------------------------------------------------------------
-- Persiapan & tamu
-- ---------------------------------------------------------------------------
create table public.prep_tasks (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  phase text not null check (phase in ('12plus','6to12','3to6','1to3','1to2w','1w','1d','dday')),
  done boolean not null default false,
  deadline date,
  assignee text,
  priority text check (priority in ('low','medium','high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null,
  revision integer not null default 1,
  unique (wedding_id, id)
);

create table public.guests (                     -- satu baris = satu undangan/grup
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  tag text,
  invited_count integer check (invited_count is null or invited_count >= 1),   -- opsional; tidak ada default 1
  confirmed_count integer check (confirmed_count is null or confirmed_count >= 0),
  invitation_sent boolean not null default false,
  rsvp text not null default 'pending' check (rsvp in ('pending','attending','declined')),
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null,
  revision integer not null default 1,
  unique (wedding_id, id),
  check (confirmed_count is null or invited_count is null or confirmed_count <= invited_count),
  check (rsvp <> 'declined' or coalesce(confirmed_count, 0) = 0),
  check (rsvp <> 'pending' or confirmed_count is null)
);

-- ---------------------------------------------------------------------------
-- Trigger revisi
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['weddings','deposits','fund_withdrawals','vendors','budget_items',
                           'payments','prep_tasks','guests']
  loop
    execute format('create trigger touch_row before insert or update on public.%I
                    for each row execute function public.tg_touch_row()', t);
  end loop;
end $$;

create index on public.deposits (wedding_id);
create index on public.fund_withdrawals (wedding_id);
create index on public.vendors (wedding_id);
create index on public.budget_items (wedding_id);
create index on public.payments (wedding_id, budget_item_id);
create index on public.cash_flow_entries (wedding_id);
create index on public.prep_tasks (wedding_id);
create index on public.guests (wedding_id);
