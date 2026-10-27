-- Satu harga per item: aplikasi hanya memakai final_price. Harga yang tadinya hanya estimasi
-- dipindah ke final_price (final yang sudah ada menang), lalu estimasi dikosongkan supaya
-- mengosongkan harga di aplikasi benar-benar berarti "belum dianggarkan".
-- Kolom estimated_price sengaja tidak dihapus (view/fungsi ringkasan tetap kompatibel); hapus nanti bila perlu.

update public.budget_items
   set final_price = coalesce(final_price, estimated_price),
       estimated_price = null
 where estimated_price is not null;
