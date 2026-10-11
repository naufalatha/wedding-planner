-- Arsip (bukan hapus permanen) untuk tugas, vendor, dan tamu; penanggung jawab tugas = anggota aktif.

alter table public.prep_tasks add column archived_at timestamptz;
alter table public.vendors    add column archived_at timestamptz;
alter table public.guests     add column archived_at timestamptz;

alter table public.prep_tasks add column notes text;
alter table public.prep_tasks drop column assignee;
alter table public.prep_tasks add column assignee_id uuid;
-- FK gabungan: penanggung jawab harus anggota ruang pernikahan yang sama
alter table public.prep_tasks
  add constraint prep_tasks_assignee_member_fk
  foreign key (wedding_id, assignee_id) references public.wedding_members (wedding_id, user_id);
alter table public.prep_tasks drop constraint if exists prep_tasks_priority_check;
alter table public.prep_tasks add constraint prep_tasks_priority_check check (priority in ('normal','high'));

-- Vendor terpilih: hanya yang aktif (tidak diarsipkan) dihitung per kategori
drop index public.vendors_one_selected_per_category;
create unique index vendors_one_selected_per_category
  on public.vendors (wedding_id, lower(btrim(category))) where status = 'selected' and archived_at is null;

-- Tidak ada hapus keras dari aplikasi
do $$
declare t text;
begin
  foreach t in array array['vendors','prep_tasks','guests']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('revoke delete on public.%I from authenticated', t);
  end loop;
end $$;
