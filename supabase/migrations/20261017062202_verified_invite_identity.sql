-- Bind invitation identity to verified Auth email, never editable profile metadata.
create or replace function private.dg_current_verified_email()
returns text language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null
$$;
revoke all on function private.dg_current_verified_email() from public, anon;
grant execute on function private.dg_current_verified_email() to authenticated;

do $migration$
declare definition text; old_lookup constant text := 'select lower(p.email) into v_mail from public.profiles p where p.id = v_uid;';
begin
  definition := pg_get_functiondef('public.dg_invite_respond(uuid,boolean)'::regprocedure);
  if position(old_lookup in definition) = 0 then
    if position('private.dg_current_verified_email()' in definition) = 0 then
      raise exception 'Invite response body changed; inspect before applying this migration';
    end if;
  else
    execute replace(definition, old_lookup, 'v_mail := private.dg_current_verified_email();');
  end if;
end $migration$;
alter function public.dg_invite_respond(uuid,boolean) set search_path = '';
revoke all on function public.dg_invite_respond(uuid,boolean) from public, anon;
grant execute on function public.dg_invite_respond(uuid,boolean) to authenticated;

alter policy invites_select on public.park_invites
using (
  invited_by = (select auth.uid())
  or lower(email) = (select private.dg_current_verified_email())
  or (select private.is_admin())
  or exists(select 1 from public.projects pr where pr.park_id = park_invites.park_id and pr.owner = (select auth.uid()))
);
comment on function private.dg_current_verified_email() is
  'Current authenticated user verified email from Auth; no caller-supplied identity, fixed search_path, no anonymous execution.';
