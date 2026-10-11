-- Skenario kriteria penerimaan 3, 4, 7 + penulisan oleh pasangan. Memakai helper schema t dari tes 10.
\set u5 '55555555-5555-5555-5555-555555555555'
\set u6 '66666666-6666-6666-6666-666666666666'
\set u7 '77777777-7777-7777-7777-777777777777'

set role authenticated;
select set_config('request.jwt.claim.sub', :'u5', false);
select public.create_wedding('Satu','Dua', null, null, 50000000, 20000000, null) as wa \gset
select public.create_invitation(:'wa') as codea \gset
select set_config('request.jwt.claim.sub', :'u6', false);
select public.redeem_invitation(:'codea');

-- Kriteria 1: pasangan (u6) dapat menulis ke ruang yang sama
insert into public.deposits (wedding_id, contributor, amount, deposited_on) values (:'wa','Pasangan',5000000,'2026-10-01');
select t.eq((select collected from public.finance_summary(:'wa')), 25000000::bigint, 'partner menulis, owner/partner melihat dana');

-- Kriteria 3: item Rp10 jt, DP Rp3 jt lalu Rp7 jt dari dana pernikahan
insert into public.budget_items (wedding_id, section, name, estimated_price) values (:'wa','vendor','Katering',10000000);
select id as kat from public.budget_items where wedding_id = :'wa' and name = 'Katering' \gset
select public.record_payment(:'wa','bbbbbbbb-0000-0000-0000-000000000001',:'kat','payment',3000000,'2026-10-02') as pay1 \gset
select public.record_payment(:'wa','bbbbbbbb-0000-0000-0000-000000000002',:'kat','payment',7000000,'2026-10-03') as pay2 \gset
select public.record_payment(:'wa','bbbbbbbb-0000-0000-0000-000000000002',:'kat','payment',7000000,'2026-10-03'); -- retry
select t.eq((select paid_amount from public.budget_item_status where budget_item_id = :'kat'), 10000000::bigint, 'dibayar 10 jt');
select t.eq((select remaining from public.budget_item_status where budget_item_id = :'kat'), 0::bigint, 'sisa nol');
select t.eq((select status from public.budget_item_status where budget_item_id = :'kat'), 'lunas', 'lunas');
select t.eq((select available_balance from public.finance_summary(:'wa')), 15000000::bigint, 'saldo berkurang 10 jt tepat sekali');

-- Kriteria 4: batal pembayaran mengoreksi arus kas dalam satu langkah
select public.cancel_record(:'wa','payment',:'pay2','salah nominal');
select t.eq((select available_balance from public.finance_summary(:'wa')), 22000000::bigint, 'batal 7 jt mengembalikan saldo');
select t.eq((select paid_amount from public.budget_item_status where budget_item_id = :'kat'), 3000000::bigint, 'dibayar kembali 3 jt');
select t.eq((select status from public.budget_item_status where budget_item_id = :'kat'), 'dp', 'status kembali DP');
select t.eq((select count(*) from public.payments where id = :'pay2' and cancelled_at is not null and cancel_reason = 'salah nominal'), 1::bigint, 'audit pembatalan tersimpan');
select t.fails(format($$select public.cancel_record(%L,'payment',%L,'lagi')$$, :'wa', :'pay2'), 'not_found_or_already_cancelled', 'batal ganda ditolak');

-- refund diterima lalu dibatalkan: kas ikut dikoreksi
select public.record_payment(:'wa','bbbbbbbb-0000-0000-0000-000000000003',:'kat','refund',1000000,'2026-10-04','wedding_fund',:'pay1') as ref1 \gset
select public.mark_refund_received(:'wa', :'ref1');
select t.eq((select available_balance from public.finance_summary(:'wa')), 23000000::bigint, 'refund diterima menambah saldo');
select public.cancel_record(:'wa','payment',:'ref1','refund dibatalkan');
select t.eq((select available_balance from public.finance_summary(:'wa')), 22000000::bigint, 'batal refund diterima mengoreksi saldo');

-- item dengan pembayaran aktif tidak bisa dibatalkan
select t.fails(format($$select public.cancel_record(%L,'budget_item',%L,'x')$$, :'wa', :'kat'), 'has_active_payments', 'item berpembayaran');

-- Kriteria 7: arsip tugas, penanggung jawab anggota, tanpa hapus keras
insert into public.prep_tasks (wedding_id, title, phase, assignee_id) values (:'wa','Cari gedung','12plus',:'u6');
insert into public.prep_tasks (wedding_id, title, phase) values (:'wa','Cari MC','6to12');
select t.fails(format($$insert into public.prep_tasks (wedding_id,title,phase,assignee_id) values (%L,'X','1w',%L)$$, :'wa', :'u7'), 'violates foreign key', 'penanggung jawab bukan anggota');
update public.prep_tasks set archived_at = now() where title = 'Cari MC';
select t.eq((select count(*) from public.prep_tasks where wedding_id = :'wa' and archived_at is null), 1::bigint, 'arsip tidak dihitung aktif');
select t.fails($$delete from public.prep_tasks$$, 'permission denied', 'hapus keras tugas ditolak');
select t.fails($$delete from public.guests$$, 'permission denied', 'hapus keras tamu ditolak');
select t.fails($$delete from public.vendors$$, 'permission denied', 'hapus keras vendor ditolak');

-- vendor terpilih tidak membuat transaksi; arsip melepaskan slot "terpilih"
select count(*) as pay_before from public.payments where wedding_id = :'wa' \gset
insert into public.vendors (wedding_id, category, name, status) values (:'wa','Venue','V1','selected');
select t.eq((select count(*) from public.payments where wedding_id = :'wa'), :pay_before::bigint, 'vendor terpilih tak menambah transaksi');
update public.vendors set archived_at = now() where name = 'V1';
insert into public.vendors (wedding_id, category, name, status) values (:'wa','Venue','V2','selected');
reset role;
\echo 'tes 20 selesai'
