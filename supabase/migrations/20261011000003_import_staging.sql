-- Staging importer satu kali. Hanya dapat diakses oleh pemilik database / tooling
-- (RLS aktif tanpa policy, tanpa grant ke anon/authenticated).

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  source_label text not null,
  source_fingerprint text not null,            -- sha256 isi workbook/dump
  status text not null default 'previewed' check (status in ('previewed','committed')),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  unique (wedding_id, id)
);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  batch_id uuid not null,
  source_key text not null,                    -- identitas stabil baris sumber
  entity text not null check (entity in ('wedding','deposit','budget_item','payment','vendor','task','guest')),
  provenance jsonb not null,                   -- {sheet, cell}
  payload jsonb not null,
  payload_hash text not null,
  state text not null check (state in ('ready','needs_review','committed','unchanged','changed')),
  review_reason text,
  target_table text,
  target_id uuid,
  created_at timestamptz not null default now(),
  foreign key (wedding_id, batch_id) references public.import_batches (wedding_id, id),
  unique (wedding_id, source_key)              -- satu hasil impor per identitas sumber
);

alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;
revoke all on public.import_batches, public.import_rows from anon, authenticated;
