\set u8 '88888888-8888-8888-8888-888888888888'
\set u9 '99999999-9999-9999-9999-999999999999'
set role authenticated;
select set_config('request.jwt.claim.sub', :'u8', false);
select public.create_wedding('A','B', null, null, null, 0, null) as wc \gset

-- tiga item: estimasi saja, final menggantikan estimasi, tanpa harga sama sekali
insert into public.budget_items (wedding_id, section, name, estimated_price, final_price) values
  (:'wc','vendor','Satu',10000000,null), (:'wc','vendor','Dua',5000000,4000000), (:'wc','paperwork','Tiga',null,null);
select t.eq((select total_estimated from public.finance_summary(:'wc')), 15000000::bigint, 'total estimasi');
select t.eq((select total_committed from public.finance_summary(:'wc')), 14000000::bigint, 'komitmen = final bila ada, selain itu estimasi');
select t.eq((select unpriced_count from public.finance_summary(:'wc')), 1, 'item belum dianggarkan dihitung terpisah');
select t.eq((select estimate_based_count from public.finance_summary(:'wc')), 1, 'item yang masih berbasis estimasi');
select t.eq((select plan_remaining from public.finance_summary(:'wc')), null::bigint, 'tanpa batas anggaran, sisa rencana kosong (bukan nol)');
update public.weddings set budget_cap = 20000000 where id = :'wc';
select t.eq((select plan_remaining from public.finance_summary(:'wc')), 6000000::bigint, 'sisa anggaran rencana = batas - komitmen');

-- pergantian vendor terpilih atomik, riwayat kandidat lama dipertahankan
insert into public.vendors (wedding_id, category, name, package, link) values
  (:'wc','Venue','V1','Paket A','https://contoh.test/v1'), (:'wc','Venue','V2',null,null);
select id as v1 from public.vendors where name = 'V1' and wedding_id = :'wc' \gset
select id as v2 from public.vendors where name = 'V2' and wedding_id = :'wc' \gset
select public.select_vendor(:'wc', :'v1');
select t.eq((select status from public.vendors where id = :'v1'), 'selected', 'v1 terpilih');
select public.select_vendor(:'wc', :'v2');
select t.eq((select status from public.vendors where id = :'v2'), 'selected', 'v2 terpilih');
select t.eq((select status from public.vendors where id = :'v1'), 'candidate', 'v1 kembali kandidat, tidak hilang');
select t.eq((select count(*) from public.vendors where wedding_id = :'wc' and status = 'selected'), 1::bigint, 'tepat satu terpilih');
select t.eq((select count(*) from public.payments where wedding_id = :'wc'), 0::bigint, 'memilih vendor tidak membuat transaksi');
-- hubungkan vendor ke item anggaran (FK gabungan)
update public.budget_items set vendor_id = :'v2' where name = 'Satu' and wedding_id = :'wc';
select t.eq((select count(*) from public.budget_items where vendor_id = :'v2'), 1::bigint, 'item terhubung ke vendor');
-- ruang lain tidak boleh memilih vendor ini
select set_config('request.jwt.claim.sub', :'u9', false);
select public.create_wedding('C','D') as wd \gset
select t.fails(format($$select public.select_vendor(%L,%L)$$, :'wd', :'v1'), 'vendor_not_found', 'vendor lintas ruang');
select t.fails(format($$select public.select_vendor(%L,%L)$$, :'wc', :'v1'), 'forbidden', 'non-anggota');
reset role;
\echo 'tes 30 selesai'
