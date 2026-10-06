-- Kullanıcı yalnız kendi veri talebini silebilir.
-- SELECT politikası zaten user_id = auth.uid() veya admin ile sınırlar.
create policy "dreq_delete_own"
on public.data_requests
for delete
to authenticated
using ((select auth.uid()) = user_id);
