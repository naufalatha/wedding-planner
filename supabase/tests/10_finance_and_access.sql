-- Tes skema: keuangan, RLS, undangan, idempotensi. Berjalan sebagai role `authenticated`.
create schema t;
grant usage on schema t to authenticated, anon;
create function t.eq(actual anyelement, expected anyelement, label text) returns void
language plpgsql as $$ begin
  if actual is distinct from expected then
    raise exception 'GAGAL [%]: dapat %, seharusnya %', label, actual, expected;
  end if;
end $$;
-- Menjalankan SQL dan memastikan ia gagal dengan pesan tertentu
create function t.fails(stmt text, needle text, label text) returns void
language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like '%' || needle || '%' then return; end if;
    raise exception 'GAGAL [%]: error tak sesuai: % (cari "%")', label, sqlerrm, needle;
  end;
  raise exception 'GAGAL [%]: seharusnya error "%" tetapi berhasil', label, needle;
end $$;
grant execute on all functions in schema t to authenticated, anon;

\set u1 '11111111-1111-1111-1111-111111111111'
\set u2 '22222222-2222-2222-2222-222222222222'
\set u3 '33333333-3333-3333-3333-333333333333'
\set u4 '44444444-4444-4444-4444-444444444444'

-- ============ Setup sebagai u1 (owner) ============
set role authenticated;
select set_config('request.jwt.claim.sub', :'u1', false);

select public.create_wedding('Naufal Atha Yudha', 'Bella Aprilia', '2027-08-28', 'TBA - Bogor',
                             100000000, 0, 69715000) as w1 \gset
select t.fails($$select public.create_wedding('X','Y')$$, 'already_in_wedding', 'satu wedding per akun');

-- enam setoran = Rp42.000.000
insert into public.deposits (wedding_id, contributor, amount, deposited_on) values
 (:'w1','Groom',20000000,'2025-04-30'),(:'w1','Groom',2500000,'2025-05-01'),
 (:'w1','Groom',2500000,'2025-06-03'),(:'w1','Groom',2500000,'2025-07-01'),
 (:'w1','Groom',2000000,'2025-07-12'),(:'w1','Groom',12500000,'2026-01-25');

select t.eq((select collected from public.finance_summary(:'w1')), 42000000::bigint, 'dana terkumpul');
select t.eq((select funding_progress from public.finance_summary(:'w1')), 0.42::numeric, 'progres 42%');
select t.eq((select available_balance from public.finance_summary(:'w1')), 42000000::bigint, 'saldo awal');
select t.eq((select plan_remaining from public.finance_summary(:'w1')), 69715000::bigint, 'sisa anggaran = cap (belum ada komitmen)');

-- item venue: estimasi 9,5 jt
insert into public.budget_items (wedding_id, section, category, name, estimated_price)
values (:'w1','vendor','VENUE','Gedung Contoh',9500000);
select id as venue from public.budget_items where name like 'Gedung%' \gset
-- item tanpa harga sama sekali (kosong != 0)
insert into public.budget_items (wedding_id, section, name) values (:'w1','paperwork','Pas Foto');
select id as foto from public.budget_items where name = 'Pas Foto' \gset
select t.eq((select status from public.budget_item_status where budget_item_id = :'foto'), 'belum_dibayar', 'item tanpa harga');
select t.eq((select committed_price from public.budget_item_status where budget_item_id = :'foto'), null::bigint, 'kosong bukan nol');

-- ============ Pembayaran ============
select public.record_payment(:'w1', 'aaaaaaaa-0000-0000-0000-000000000001', :'venue', 'payment', 3500000, '2026-09-01') as p1 \gset
select t.eq((select status from public.budget_item_status where budget_item_id = :'venue'), 'dp', 'status DP');
select t.eq((select remaining from public.budget_item_status where budget_item_id = :'venue'), 6000000::bigint, 'sisa tagihan');
select t.eq((select available_balance from public.finance_summary(:'w1')), 38500000::bigint, 'saldo setelah DP');

-- idempotensi: request ID sama = hasil sama, tidak ada dobel
select t.eq(public.record_payment(:'w1','aaaaaaaa-0000-0000-0000-000000000001', :'venue','payment',3500000,'2026-09-01'),
            :'p1'::uuid, 'idempoten');
select t.eq((select count(*) from public.payments where wedding_id = :'w1'), 1::bigint, 'tidak dobel');
select t.fails(format($$select public.record_payment(%L,'aaaaaaaa-0000-0000-0000-000000000001',%L,'payment',999,'2026-09-01')$$, :'w1', :'venue'),
               'request_id_reused', 'request ID dipakai ulang beda isi');

select public.record_payment(:'w1','aaaaaaaa-0000-0000-0000-000000000002', :'venue','payment',6000000,'2026-09-02') ;
select t.eq((select status from public.budget_item_status where budget_item_id = :'venue'), 'lunas', 'lunas');
select public.record_payment(:'w1','aaaaaaaa-0000-0000-0000-000000000003', :'venue','payment',100000,'2026-09-03') as p3 \gset
select t.eq((select status from public.budget_item_status where budget_item_id = :'venue'), 'kelebihan_bayar', 'kelebihan bayar');
select t.eq((select remaining from public.budget_item_status where budget_item_id = :'venue'), -100000::bigint, 'sisa negatif ditampilkan');

-- refund: tercatat mengurangi net paid, tapi kas baru masuk saat diterima
select public.record_payment(:'w1','aaaaaaaa-0000-0000-0000-000000000004', :'venue','refund',100000,'2026-09-04','wedding_fund',:'p3') as r1 \gset
select t.eq((select status from public.budget_item_status where budget_item_id = :'venue'), 'lunas', 'lunas lagi setelah refund');
select t.eq((select available_balance from public.finance_summary(:'w1')), 32400000::bigint, 'refund belum diterima, saldo belum naik');
select t.fails(format($$select public.record_payment(%L,'aaaaaaaa-0000-0000-0000-000000000005',%L,'refund',1,'2026-09-04','wedding_fund',%L)$$, :'w1', :'venue', :'p3'),
               'refund_exceeds_payment', 'refund melebihi pembayaran');
select public.mark_refund_received(:'w1', :'r1');
select public.mark_refund_received(:'w1', :'r1');  -- idempoten
select t.eq((select available_balance from public.finance_summary(:'w1')), 32500000::bigint, 'refund diterima');
select t.eq((select count(*) from public.cash_flow_entries where wedding_id = :'w1'), 4::bigint, 'satu entri kas per pembayaran/refund');

-- dibayar terpisah tidak menyentuh saldo
select public.record_payment(:'w1','aaaaaaaa-0000-0000-0000-000000000006', :'foto','payment',50000,'2026-09-05','separate');
select t.eq((select available_balance from public.finance_summary(:'w1')), 32500000::bigint, 'dibayar terpisah tak ubah saldo');
select t.eq((select status from public.budget_item_status where budget_item_id = :'foto'), 'dp', 'bayar tanpa harga = DP');

-- harga final menggantikan estimasi
update public.budget_items set final_price = 9000000 where id = :'venue';
select t.eq((select committed_price from public.budget_item_status where budget_item_id = :'venue'), 9000000::bigint, 'harga final dipakai');
select t.eq((select status from public.budget_item_status where budget_item_id = :'venue'), 'kelebihan_bayar', 'kelebihan vs harga final');
select t.eq((select total_committed from public.finance_summary(:'w1')), 9000000::bigint, 'total komitmen');

-- pembatalan teraudit
select t.fails(format($$select public.cancel_record(%L,'payment',%L,'salah')$$, :'w1', :'p3'), 'has_active_refunds', 'batal dengan refund aktif');
select t.fails(format($$select public.cancel_record(%L,'deposit',gen_random_uuid(),'  ')$$, :'w1'), 'reason_required', 'alasan wajib');
select t.fails(format($$update public.deposits set cancelled_at = now() where wedding_id = %L$$, :'w1'), 'permission denied', 'batal langsung ditolak');
select id as dep1 from public.deposits where wedding_id = :'w1' and amount = 2000000 \gset
select public.cancel_record(:'w1','deposit',:'dep1','salah input');
select t.eq((select collected from public.finance_summary(:'w1')), 40000000::bigint, 'setoran batal tak dihitung');
select t.eq((select count(*) from public.deposits where wedding_id = :'w1'), 6::bigint, 'baris tetap ada (tidak hapus keras)');

-- ============ Tamu ============
insert into public.guests (wedding_id, name, tag) values (:'w1','Tamu Contoh dan Pasangan','Teman');
select t.eq((select invited_count from public.guests where name like 'Tamu Contoh%'), null::int, 'headcount kosong, bukan 1');
select t.fails(format($$insert into public.guests (wedding_id,name,invited_count,confirmed_count,rsvp) values (%L,'A',2,3,'attending')$$, :'w1'),
               'violates check', 'hadir > diundang');
select t.fails(format($$insert into public.guests (wedding_id,name,invited_count,confirmed_count,rsvp) values (%L,'B',2,2,'declined')$$, :'w1'),
               'violates check', 'tidak hadir harus 0');
insert into public.guests (wedding_id,name,invited_count,confirmed_count,rsvp) values (:'w1','C',2,0,'declined');

-- compare-and-set revisi
select revision as rev from public.guests where name = 'C' \gset
with u as (update public.guests set notes = 'a' where name = 'C' and revision = :rev returning 1) select t.eq((select count(*) from u), 1::bigint, 'CAS pertama');
with u as (update public.guests set notes = 'b' where name = 'C' and revision = :rev returning 1) select t.eq((select count(*) from u), 0::bigint, 'CAS basi ditolak');

-- vendor: satu terpilih per kategori
insert into public.vendors (wedding_id, category, name, status) values (:'w1','Venue','Gedung Contoh','selected');
select t.fails(format($$insert into public.vendors (wedding_id,category,name,status) values (%L,'venue','Lain','selected')$$, :'w1'),
               'vendors_one_selected_per_category', 'dua vendor terpilih');

-- ============ Undangan pasangan ============
select public.create_invitation(:'w1') as code \gset
reset role;
select t.eq((select count(*) from public.wedding_invitations where code_hash = digest(:'code','sha256')), 1::bigint, 'hanya hash tersimpan');
select t.eq((select count(*) from public.wedding_invitations where code_hash::text like '%' || :'code' || '%'), 0::bigint, 'kode asli tidak tersimpan');
set role authenticated;

select set_config('request.jwt.claim.sub', :'u2', false);
select t.fails($$select public.redeem_invitation('SALAHSALAH')$$, 'invalid_invitation', 'kode salah');
select t.eq(public.redeem_invitation(:'code'), :'w1'::uuid, 'u2 bergabung');
select t.fails(format($$select public.redeem_invitation(%L)$$, :'code'), 'invalid_invitation', 'kode sekali pakai');
select t.eq((select count(*) from public.deposits), 6::bigint, 'partner melihat data wedding');
select t.eq((select role from public.wedding_members where user_id = :'u2'), 'partner', 'peran partner');

-- batas 2 anggota & hanya owner membuat undangan
select t.fails(format($$select public.create_invitation(%L)$$, :'w1'), 'forbidden', 'partner tak boleh undang');
select set_config('request.jwt.claim.sub', :'u1', false);
select t.fails(format($$select public.create_invitation(%L)$$, :'w1'), 'member_limit_reached', 'maks 2 anggota');

-- ============ Isolasi antar wedding & akses langsung ============
select set_config('request.jwt.claim.sub', :'u3', false);
select public.create_wedding('Orang','Lain') as w2 \gset
select t.eq((select count(*) from public.deposits), 0::bigint, 'u3 tak melihat setoran u1');
select t.eq((select count(*) from public.guests), 0::bigint, 'u3 tak melihat tamu u1');
select t.eq((select count(*) from public.weddings), 1::bigint, 'u3 hanya melihat wedding sendiri');
select t.fails(format($$insert into public.guests (wedding_id,name) values (%L,'penyusup')$$, :'w1'), 'row-level security', 'tulis ke wedding lain');
select t.fails(format($$select public.record_payment(%L,gen_random_uuid(),%L,'payment',1,'2026-01-01')$$, :'w1', :'venue'), 'forbidden', 'bayar di wedding lain');
select t.fails(format($$select public.record_payment(%L,gen_random_uuid(),%L,'payment',1,'2026-01-01')$$, :'w2', :'venue'), 'item_not_found', 'item wedding lain via wedding sendiri');
select t.fails(format($$insert into public.wedding_members (wedding_id,user_id,role) values (%L,%L,'partner')$$, :'w1', :'u3'), 'permission denied', 'insert anggota langsung');
select t.fails(format($$insert into public.payments (wedding_id,budget_item_id,request_id,type,amount,paid_on,funding_source) values (%L,%L,gen_random_uuid(),'payment',1,'2026-01-01','separate')$$, :'w2', :'venue'), 'permission denied', 'insert pembayaran langsung');
select t.fails(format($$select code_hash from public.wedding_invitations$$), 'permission denied', 'hash tak terbaca klien');

-- anon tidak punya akses
reset role; set role anon;
select t.fails($$select * from public.weddings$$, 'permission denied', 'anon ditolak');
reset role;

-- kedaluwarsa 7 hari
select set_config('request.jwt.claim.sub', :'u1', false);
reset role;
update public.wedding_invitations set expires_at = now() - interval '1 second';
delete from public.wedding_members where user_id = :'u2';
set role authenticated;
select set_config('request.jwt.claim.sub', :'u1', false);
select public.create_invitation(:'w1') as code2 \gset
reset role;
update public.wedding_invitations set expires_at = now() - interval '1 second' where redeemed_at is null;
set role authenticated;
select set_config('request.jwt.claim.sub', :'u4', false);
select t.fails(format($$select public.redeem_invitation(%L)$$, :'code2'), 'invalid_invitation', 'kode kedaluwarsa');
reset role;
\echo 'tes 10_finance_and_access selesai'
