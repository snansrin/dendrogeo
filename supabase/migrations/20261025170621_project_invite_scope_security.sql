-- Authorization only: no backfill, research-row update, deletion or reparenting.
begin;

create or replace function private.dg_shared_project_access(p_project bigint)
returns boolean language sql stable security definer set search_path='' as $$
 select case when auth.uid() is null then false else
  (select private.is_active()) and exists(
   select 1 from public.projects pr
   join public.park_collaborators c on c.park_id=pr.park_id and c.user_id=(select auth.uid())
   join auth.users recipient on recipient.id=c.user_id and recipient.email_confirmed_at is not null
   join public.park_invites i on i.park_id=pr.park_id and lower(i.email)=lower(recipient.email)
   join public.profiles sender on sender.id=i.invited_by and sender.active
   where pr.id=p_project and i.status='Kabul' and i.responded_at>=c.added_at
    and (i.invited_by=pr.owner or sender.role in('admin','owner'))
  ) end
$$;
revoke all on function private.dg_shared_project_access(bigint) from public,anon;
-- Anonymous measurement policies may evaluate this guard; its NULL-uid branch
-- returns false without exposing project or invitation data. Private is not API-exposed.
grant execute on function private.dg_shared_project_access(bigint) to anon,authenticated;

create or replace function private.dg_manage_park_collaborator(p_park bigint,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select case when auth.uid() is null then false else
  (select private.is_admin()) or ((select private.is_active()) and exists(
   select 1 from public.park_collaborators c
   join auth.users recipient on recipient.id=c.user_id and recipient.email_confirmed_at is not null
   join public.park_invites i on i.park_id=c.park_id and lower(i.email)=lower(recipient.email)
   where c.park_id=p_park and c.user_id=p_user and i.invited_by=(select auth.uid())
    and i.status='Kabul' and i.responded_at>=c.added_at
    and exists(select 1 from public.projects pr where pr.park_id=c.park_id and pr.owner=(select auth.uid()))
  )) end
$$;
revoke all on function private.dg_manage_park_collaborator(bigint,uuid) from public,anon;
grant execute on function private.dg_manage_park_collaborator(bigint,uuid) to authenticated;

alter policy projects_select on public.projects to authenticated using(
 owner=(select auth.uid()) or (select private.is_admin())
 or private.dg_shared_project_access(id)
);
alter policy meas_select on public.measurements to anon,authenticated using(
 status='Onaylı' or ((select auth.uid()) is not null and (
  owner=(select auth.uid()) or (select private.is_admin())
  or (park_id is not null and exists(select 1 from public.projects pr
   where pr.id=measurements.project_id and pr.park_id=measurements.park_id
    and (pr.owner=(select auth.uid()) or private.dg_shared_project_access(pr.id))))
 ))
);
alter policy invites_select on public.park_invites to authenticated using(
 invited_by=(select auth.uid()) or lower(email)=(select private.dg_current_verified_email())
 or (select private.is_admin())
);
alter policy collab_select on public.park_collaborators to authenticated using(
 user_id=(select auth.uid()) or private.dg_manage_park_collaborator(park_id,user_id)
);

create or replace function public.dg_invite_send(p_park bigint,p_email text,p_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_mail text;v_id uuid;
begin
 if v_uid is null then raise exception 'INVITE_AUTH: giriş gerekli' using errcode='42501';end if;
 if not private.is_active() then raise exception 'INVITE_INACTIVE' using errcode='42501';end if;
 if private.dg_current_verified_email() is null then raise exception 'INVITE_VERIFIED_EMAIL_REQUIRED' using errcode='42501';end if;
 v_mail:=lower(trim(coalesce(p_email,'')));
 if v_mail !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'INVITE_BAD_EMAIL';end if;
 if not (private.is_admin() or exists(select 1 from public.projects pr where pr.park_id=p_park and pr.owner=v_uid)) then
  raise exception 'INVITE_NOT_YOUR_PARK' using errcode='42501';end if;
 if v_mail=private.dg_current_verified_email() then raise exception 'INVITE_SELF';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dg-park-invites/'||p_park::text,0));
 if exists(select 1 from public.park_invites i
   join auth.users recipient on lower(recipient.email)=lower(i.email) and recipient.email_confirmed_at is not null
   join public.park_collaborators c on c.park_id=i.park_id and c.user_id=recipient.id
   where i.park_id=p_park and lower(i.email)=v_mail and i.invited_by=v_uid
    and i.status='Kabul' and i.responded_at>=c.added_at) then
  raise exception 'INVITE_ALREADY_COLLAB';end if;
 -- One owner cannot cancel another team's pending invitation.
 update public.park_invites set status='İptal',responded_at=clock_timestamp()
  where park_id=p_park and lower(email)=v_mail and status='Beklemede' and invited_by=v_uid;
 insert into public.park_invites(park_id,email,note,invited_by)
  values(p_park,v_mail,nullif(trim(coalesce(p_note,'')),''),v_uid) returning id into v_id;
 return v_id;
end $$;

create or replace function public.dg_invite_respond(p_invite uuid,p_accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_mail text;v_inv public.park_invites;stamp timestamptz;
begin
 if v_uid is null then raise exception 'INVITE_AUTH: giriş gerekli' using errcode='42501';end if;
 v_mail:=private.dg_current_verified_email();
 select * into v_inv from public.park_invites where id=p_invite;
 if v_inv.id is null then raise exception 'INVITE_NOT_FOUND';end if;
 if v_mail is null or lower(v_inv.email)<>v_mail then raise exception 'INVITE_NOT_YOURS' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dg-park-invites/'||v_inv.park_id::text,0));
 select * into v_inv from public.park_invites where id=p_invite for update;
 if v_inv.status<>'Beklemede' then raise exception 'INVITE_CLOSED';end if;
 if p_accept then
  if not private.is_active() then raise exception 'INVITE_INACTIVE' using errcode='42501';end if;
  if not exists(select 1 from public.profiles sender where sender.id=v_inv.invited_by and sender.active
   and (sender.role in('admin','owner') or exists(select 1 from public.projects pr where pr.park_id=v_inv.park_id and pr.owner=sender.id))) then
   raise exception 'INVITE_SENDER_NO_LONGER_AUTHORIZED' using errcode='42501';end if;
 end if;
 -- Use one wall-clock instant, not transaction-start now(), for a fresh membership
 -- epoch. Leaving and rejoining must never revive older accepted invitations.
 stamp:=clock_timestamp();
 update public.park_invites set status=case when p_accept then 'Kabul' else 'Red' end,responded_at=stamp where id=p_invite;
 if p_accept then
  insert into public.park_collaborators(park_id,user_id,added_at) values(v_inv.park_id,v_uid,stamp)
   on conflict(park_id,user_id) do nothing;
 end if;
end $$;

create or replace function public.dg_invite_revoke(p_park bigint,p_target text,p_kind text)
returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_admin boolean;v_mail text;v_target uuid;v_inv public.park_invites;
begin
 if v_uid is null then raise exception 'INVITE_AUTH: giriş gerekli' using errcode='42501';end if;
 if not private.is_active() then raise exception 'INVITE_INACTIVE' using errcode='42501';end if;
 v_admin:=private.is_admin();
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dg-park-invites/'||p_park::text,0));
 if p_kind='invite' then
  select * into v_inv from public.park_invites where id=p_target::uuid and park_id=p_park for update;
  if v_inv.id is null or not(v_admin or (v_inv.invited_by=v_uid and exists(select 1 from public.projects pr where pr.park_id=p_park and pr.owner=v_uid))) then
   raise exception 'INVITE_NOT_YOURS' using errcode='42501';end if;
  update public.park_invites set status='İptal',responded_at=clock_timestamp() where id=v_inv.id and status in('Beklemede','Kabul');
  select id into v_target from auth.users where lower(email)=lower(v_inv.email) and email_confirmed_at is not null;
 elsif p_kind='collab' then
  v_target:=p_target::uuid;
  if not private.dg_manage_park_collaborator(p_park,v_target) then raise exception 'INVITE_NOT_YOURS' using errcode='42501';end if;
  select lower(email) into v_mail from auth.users where id=v_target and email_confirmed_at is not null;
  update public.park_invites set status='İptal',responded_at=clock_timestamp()
   where park_id=p_park and lower(email)=v_mail and status='Kabul' and (v_admin or invited_by=v_uid);
 else raise exception 'INVITE_BAD_KIND';end if;
 if v_target is not null then
  delete from public.park_collaborators c where c.park_id=p_park and c.user_id=v_target
   and not exists(select 1 from public.park_invites i
    join auth.users recipient on recipient.id=c.user_id and recipient.email_confirmed_at is not null
    join public.profiles sender on sender.id=i.invited_by and sender.active
    where i.park_id=c.park_id and lower(i.email)=lower(recipient.email) and i.status='Kabul'
     and i.responded_at>=c.added_at
     and (sender.role in('admin','owner') or exists(select 1 from public.projects pr where pr.park_id=p_park and pr.owner=sender.id)));
 end if;
end $$;

create or replace function private.dg_leave_park(p_park bigint) returns boolean
language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dg-park-invites/'||p_park::text,0));
 delete from public.park_collaborators where park_id=p_park and user_id=auth.uid();
 get diagnostics changed=row_count;return changed>0;
end $$;

revoke all on function public.dg_invite_send(bigint,text,text),public.dg_invite_respond(uuid,boolean),public.dg_invite_revoke(bigint,text,text),private.dg_leave_park(bigint) from public,anon;
grant execute on function public.dg_invite_send(bigint,text,text),public.dg_invite_respond(uuid,boolean),public.dg_invite_revoke(bigint,text,text),private.dg_leave_park(bigint) to authenticated;
comment on function private.dg_shared_project_access(bigint) is 'Private-project permission requires a current membership and accepted invitation from that project owner or an active administrator; creating another project in the same park never grants this permission.';
comment on function public.dg_is_park_member(bigint) is 'Park/presence membership only. Do not use this broad park predicate to authorize private project or draft-measurement reads; use scoped project policies.';
commit;
