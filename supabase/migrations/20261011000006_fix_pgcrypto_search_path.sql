-- Di Supabase, pgcrypto (digest, gen_random_bytes) ada di schema `extensions`.
-- Fungsi undangan memakai search_path terkunci tanpa schema itu, sehingga gagal
-- ("function gen_random_bytes(integer) does not exist"). Tambahkan `extensions`.
alter function public.create_invitation(uuid) set search_path = public, extensions, pg_temp;
alter function public.redeem_invitation(text) set search_path = public, extensions, pg_temp;
