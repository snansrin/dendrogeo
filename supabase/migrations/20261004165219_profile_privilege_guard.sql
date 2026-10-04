-- Saha denetimi: kendi profilini düzenleme izni rol/aktiflik yetkisi vermez.
-- Ölçüm, park, rapor, formül ve mevcut kullanıcı değerleri değiştirilmez.
begin;
create or replace function public.dg_guard_profile_privileges()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.id is distinct from old.id then
      raise exception 'PROFILE_ID_IMMUTABLE: profil kimliği değiştirilemez'
        using errcode = '42501';
    end if;
    if (new.role is distinct from old.role or new.active is distinct from old.active)
       and not public.is_owner() then
      raise exception 'PROFILE_PRIVILEGES_OWNER_ONLY: rol ve aktifliği yalnız kurucu değiştirebilir'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.dg_guard_profile_privileges() from public, anon, authenticated;
drop trigger if exists trg_guard_profile_privileges on public.profiles;
create trigger trg_guard_profile_privileges
before update of id, role, active on public.profiles
for each row execute function public.dg_guard_profile_privileges();
commit;
