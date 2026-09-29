-- 0025_park_invites.sql — PARK ÇALIŞMA ARKADAŞI (2026-09-29)
--
-- Kullanıcı isteği: "park çalışma arkadaşı daveti — beraber aynı projeye
-- veri girilmesini sağlasın." Tasarım ilkeleri (mevcut güvenlik mimarisiyle
-- aynı dil):
--   · Daveti YALNIZ parkın SAHİBİ (projects.owner) veya yönetici açar
--     (SECURITY DEFINER RPC; e-posta lower() ile normalize).
--   · Davet e-posta ile KİMLİK DOĞRULAMAZ: e-posta yalnız ADRESTİR. Kabul,
--     davetlinin KENDİ hesabıyla (auth.uid() ↔ profiles.email eşleşmesi)
--     RPC üzerinden yapılır — başkasının davetini başkası kabul edemez.
--   · Parka BAĞLANMA (projects.park_id) hâlâ yalnız yönetici işidir
--     (0006 trg_enforce_park_admin) — işbirliği bunu GEVŞETMEZ.
--   · Konum çiti (0007 trg_geo_fence) aynen geçerli: arkadaş da park
--     poligonu dışına ölçüm giremez.
--   · RLS genişletmeleri OR-bileşenlidir (permissive): mevcut görünürlük
--     DARALMAZ, yalnız ortak park için GENİŞLER. Ölçümlerde mülkiyet
--     kayıtların owner'ında kalır (kim ölçtü belli; moderasyon/onay ve
--     rapor yazarlığı = veri sahibi önceliği 0015 ile uyumlu).
-- Idempotent: if not exists / create or replace / drop-create policy.

begin;

-- ============ 1) ŞEMA ============
create table if not exists public.park_invites (
  id          uuid primary key default gen_random_uuid(),
  park_id     bigint not null references public.parks(id) on delete cascade,
  email       text   not null,                       -- lower() normalize saklanır
  note        text,
  invited_by  uuid   not null references public.profiles(id) on delete cascade,
  status      text   not null default 'Beklemede'
              check (status in ('Beklemede','Kabul','Red','İptal')),
  created_at  timestamptz not null default now(),
  responded_at timestamptz
);
create index if not exists idx_park_invites_park    on public.park_invites(park_id);
create index if not exists idx_park_invites_email   on public.park_invites(lower(email));

create table if not exists public.park_collaborators (
  park_id     bigint not null references public.parks(id) on delete cascade,
  user_id     uuid   not null references public.profiles(id) on delete cascade,
  role        text   not null default 'member' check (role in ('member')),
  added_at    timestamptz not null default now(),
  primary key (park_id, user_id)
);

comment on table public.park_invites is
  'Park çalışma arkadaşı davetleri (0025). Davet açma/kabul/red/iptal YALNIZ RPC ile: dg_invite_send, dg_invite_respond, dg_invite_revoke. E-posta kimlik doğrulamaz; kabul auth.uid() ↔ profiles.email eşleşmesi ister.';
comment on table public.park_collaborators is
  'Kabul edilmiş park ortakları (0025). Ortak: parkın projelerine KENDİ sahibi olduğu ölçümleri girer (owner=auth.uid()); park sahibi/yönetici ortak kayıtlarını da görür ve onaylar (genişletilmiş meas_select).';

-- ============ 2) RPC'ler (SECURITY DEFINER · yetki denetimli) ============
create or replace function public.dg_invite_send(p_park bigint, p_email text, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_mail text; v_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'INVITE_AUTH: giriş gerekli' using errcode = '42501';
  end if;
  v_mail := lower(trim(coalesce(p_email, '')));
  if v_mail !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'INVITE_BAD_EMAIL: geçerli e-posta girin' using errcode = '23514';
  end if;
  -- yetki: parkın projesinin sahibi VEYA yönetici
  if not (public.is_admin() or exists (
        select 1 from public.projects pr
        where pr.park_id = p_park and pr.owner = v_uid)) then
    raise exception 'INVITE_NOT_YOUR_PARK: daveti yalnız park sahibi veya yönetici açabilir'
      using errcode = '42501';
  end if;
  -- kendine davet anlamsız
  if exists (select 1 from public.profiles p where p.id = v_uid and lower(p.email) = v_mail) then
    raise exception 'INVITE_SELF: kendinizi davet edemezsiniz' using errcode = '23514';
  end if;
  -- zaten ortaksa yeni davet yok
  if exists (
      select 1 from public.profiles p
      join public.park_collaborators c on c.user_id = p.id
      where c.park_id = p_park and lower(p.email) = v_mail) then
    raise exception 'INVITE_ALREADY_COLLAB: bu kullanıcı zaten park ortağı' using errcode = '23514';
  end if;
  -- açık (Beklemede) mükerrer davet olmasın
  update public.park_invites set status = 'İptal', responded_at = now()
   where park_id = p_park and lower(email) = v_mail and status = 'Beklemede';
  insert into public.park_invites (park_id, email, note, invited_by)
  values (p_park, v_mail, nullif(trim(coalesce(p_note, '')), ''), v_uid)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.dg_invite_respond(p_invite uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_mail text; v_inv record;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'INVITE_AUTH: giriş gerekli' using errcode = '42501';
  end if;
  select lower(p.email) into v_mail from public.profiles p where p.id = v_uid;
  select * into v_inv from public.park_invites i where i.id = p_invite for update;
  if not found then
    raise exception 'INVITE_NOT_FOUND: davet bulunamadı' using errcode = 'P0002';
  end if;
  if v_mail is null or lower(v_inv.email) <> v_mail then
    raise exception 'INVITE_NOT_YOURS: davet bu hesaba ait değil' using errcode = '42501';
  end if;
  if v_inv.status <> 'Beklemede' then
    raise exception 'INVITE_CLOSED: davet zaten kapanmış (%)', v_inv.status using errcode = '23514';
  end if;
  update public.park_invites
     set status = case when p_accept then 'Kabul' else 'Red' end,
         responded_at = now()
   where id = p_invite;
  if p_accept then
    insert into public.park_collaborators (park_id, user_id)
    values (v_inv.park_id, v_uid)
    on conflict (park_id, user_id) do nothing;
  end if;
end $$;

create or replace function public.dg_invite_revoke(p_park bigint, p_target text, p_kind text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_mail text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'INVITE_AUTH: giriş gerekli' using errcode = '42501';
  end if;
  if not (public.is_admin() or exists (
        select 1 from public.projects pr
        where pr.park_id = p_park and pr.owner = v_uid)) then
    raise exception 'INVITE_NOT_YOUR_PARK: yalnız park sahibi veya yönetici' using errcode = '42501';
  end if;
  if p_kind = 'invite' then
    update public.park_invites set status = 'İptal', responded_at = now()
     where id = p_target::uuid and park_id = p_park and status = 'Beklemede';
  elsif p_kind = 'collab' then
    delete from public.park_collaborators
     where park_id = p_park and user_id = p_target::uuid;
  else
    raise exception 'INVITE_BAD_KIND: invite|collab' using errcode = '23514';
  end if;
end $$;

-- ============ 3) ORTAK PARK LISTESİ (istemci + RLS yardımcıları) ============
create or replace view public.v_my_parks as
select p.id, p.name, p.city, p.country, p.area_m2, 'owner'::text as role
from public.parks p
where exists (select 1 from public.projects pr where pr.park_id = p.id and pr.owner = auth.uid())
union
select p.id, p.name, p.city, p.country, p.area_m2, 'collaborator'::text
from public.parks p
join public.park_collaborators c on c.park_id = p.id
where c.user_id = auth.uid();

create or replace function public.dg_is_park_member(pp bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.projects pr where pr.park_id = pp and pr.owner = auth.uid())
      or exists (select 1 from public.park_collaborators c where c.park_id = pp and c.user_id = auth.uid());
$$;

-- ============ 4) RLS ============
alter table public.park_invites       enable row level security;
alter table public.park_collaborators enable row level security;

-- davetler: gönderen + davetli (kendi e-postası) + park sahibi/yönetici görür
drop policy if exists invites_select on public.park_invites;
create policy invites_select on public.park_invites for select to authenticated using (
  invited_by = auth.uid()
  or lower(email) = (select lower(p.email) from public.profiles p where p.id = auth.uid())
  or public.is_admin()
  or exists (select 1 from public.projects pr where pr.park_id = park_invites.park_id and pr.owner = auth.uid())
);
-- yazma YALNIZ RPC ile: insert/update/delete grant'i VERİLMEZ (RLS'ten
-- bağımsız olarak PostgREST yolu kapanır; davet açma yetkisi dg_invite_send'de).

-- ortaklar: kendi üyeliğini + park sahibi/yönetici tüm listeyi görür
drop policy if exists collab_select on public.park_collaborators;
create policy collab_select on public.park_collaborators for select to authenticated using (
  user_id = auth.uid()
  or public.is_admin()
  or exists (select 1 from public.projects pr where pr.park_id = park_collaborators.park_id and pr.owner = auth.uid())
);

-- ÖLÇÜM görünürlüğü: mevcut politika + ortak park genişletmesi (OR → daralma yok)
drop policy if exists meas_select on public.measurements;
create policy meas_select on public.measurements for select to anon, authenticated
  using (
    status = 'Onaylı'
    or (auth.role() = 'authenticated' and (
         owner = auth.uid()
      or public.is_admin()
      -- 0025: ortak park — park sahibi ve kabul edilmiş ortaklar, o parkın
      -- projelerine ait TÜM kayıtları (bekleyenler dahil) görür → onay akışı.
      -- Alt sorgular YALNIZ projects/park_collaborators okur (öz-referans yok).
      or (park_id is not null and (
            exists (select 1 from public.projects pr
                     where pr.id = measurements.project_id and pr.park_id = measurements.park_id
                       and pr.owner = auth.uid())
         or exists (select 1 from public.park_collaborators c
                     where c.park_id = measurements.park_id and c.user_id = auth.uid())
      ))
    ))
  );

-- ============ 5) GRANTS ============
grant select on public.park_invites, public.park_collaborators to authenticated;
grant select on public.v_my_parks to authenticated;
grant execute on function public.dg_invite_send(bigint, text, text) to authenticated;
grant execute on function public.dg_invite_respond(uuid, boolean) to authenticated;
grant execute on function public.dg_invite_revoke(bigint, text, text) to authenticated;
grant execute on function public.dg_is_park_member(bigint) to authenticated;
-- anon: ölçüm okuma politikası 'Onaylı' dalı zaten çalışıyordu; yeni tablolar
-- anon'a KAPALI (grant yok).

commit;

-- Doğrulama (Run sonrası, iki ayrı hesapla):
--   select public.dg_invite_send(25, 'arkadas@example.com', 'saha ölçümü');
--   -- arkadaş hesabıyla:
--   select id, park_id, status from public.park_invites;        -- daveti görür
--   select public.dg_invite_respond('<invite-uuid>', true);      -- kabul
--   select * from public.v_my_parks;                             -- park listede
-- Geri alma:
--   drop policy if exists invites_select on public.park_invites;
--   drop policy if exists collab_select on public.park_collaborators;
--   drop view if exists public.v_my_parks;
--   drop function if exists public.dg_invite_send(bigint, text, text);
--   drop function if exists public.dg_invite_respond(uuid, boolean);
--   drop function if exists public.dg_invite_revoke(bigint, text, text);
--   drop function if exists public.dg_is_park_member(bigint);
--   drop table if exists public.park_invites;
--   drop table if exists public.park_collaborators;
--   -- meas_select'i 0001'deki özgün haliyle yeniden oluştur.
