-- =====================================================
-- 🌲 DendroGeo — 0006: PARK BAĞI YALNIZ YÖNETİCİ DEĞİŞTİREBİLİR
-- Idempotent · 0005 üzerine · Supabase SQL Editor'da çalıştır
--
-- GEREKÇE (kullanıcı isteği 2026-09-24):
--   "⚠ Park algılanmamış kayıtlar" bölümündeki onarım işlemini (mevcut bir
--   projeyi parka bağlama) yalnız yönetici yapabilsin.
--
-- KURAL (bilerek dar tutuldu — normal saha akışı bozulmasın):
--   · INSERT serbest: herkes park algılayıp KENDİ YENİ projesini açabilir
--     (park_id ile). Bu, ölçüm kapısının çalışması için şart.
--   · UPDATE kısıtlı: MEVCUT bir projenin park bağı yalnız is_admin()
--     (owner/admin) tarafından değiştirilebilir. Yani eski/parksız projeyi
--     parka bağlama, yanlış parkı düzeltme, birleştirme sonrası taşıma —
--     hepsi yönetici işi.
--   · parks tablosuna yazma zaten girişli kullanıcıya açık (0004): saha
--     kullanıcısı parkı algılayıp kimlik oluşturmak zorunda, yoksa ölçüm
--     giremez. Kimlik TEMİZLİĞİ (birleştir/sil/yeniden adlandır) istemcide
--     de sunucuda da yöneticiye açık.
--
-- İstemci tarafı aynı kuralı uygular (park-registry.js dgIsAdmin):
--   · karşılaştırmadaki "🌳 Park Algıla" (park bekleyen kayıtlar) → yalnız yönetici
--   · Projeler tablosundaki "🌳 Bağla" → yalnız yönetici
--   · algılama kartındaki "🔗 Mevcut projeye bağla" → yalnız yönetici
--   · ölçüm kapısı: yönetici değilse "yeni proje oluştur" yoluna yönlendirir
-- =====================================================

create or replace function public.enforce_park_admin() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  /* Yalnız park bağı DEĞİŞİYORSA denetle: etiket/ad/şehir düzenlemesi
   * normal kullanıcıda serbest kalmalı (kendi projesi). */
  if new.park_id is distinct from old.park_id and not public.is_admin() then
    raise exception
      'PARK_ADMIN_ONLY: "%" projesinin park bağını yalnız yönetici değiştirebilir.',
      coalesce(old.name, new.name, '?')
      using errcode = 'DG0PA';
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_park_admin on public.projects;
create trigger trg_enforce_park_admin
before update on public.projects
for each row execute function public.enforce_park_admin();

-- =====================================================
-- DOĞRULAMA (SQL Editor):
--   select tgname from pg_trigger where tgname='trg_enforce_park_admin';
--
--   -- normal kullanıcı olarak (request.jwt.claim.sub = kullanıcı uuid):
--   update public.projects set park_id = 1 where id = <kendi_projesi>;
--   -- → ERROR: PARK_ADMIN_ONLY
--
--   update public.projects set label = 'yeni etiket' where id = <kendi_projesi>;
--   -- → çalışır (park bağı değişmiyor)
--
--   insert into public.projects(owner,name,label,park_id)
--   values (auth.uid(),'x','deneme',1);
--   -- → çalışır (yeni proje, INSERT serbest)
-- =====================================================
