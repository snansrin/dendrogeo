-- Test yalnız geçici tabloda çalışır; gerçek profillere UPDATE/INSERT yoktur.
begin;
create temporary table dg_profile_guard_probe (id uuid primary key, full_name text, organization text, role text, active boolean);
insert into dg_profile_guard_probe values ('00000000-0000-0000-0000-000000000041','Saha test','Test','user',true);
create trigger probe_guard before update of id,role,active on dg_profile_guard_probe for each row execute function public.dg_guard_profile_privileges();
grant select,update on dg_profile_guard_probe to authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000041","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin update dg_profile_guard_probe set role='owner'; raise exception 'FAIL: user role escalation allowed'; exception when insufficient_privilege then null; end;
  begin update dg_profile_guard_probe set active=false; raise exception 'FAIL: user active change allowed'; exception when insufficient_privilege then null; end;
  begin update dg_profile_guard_probe set id='00000000-0000-0000-0000-000000000042'; raise exception 'FAIL: id reassignment allowed'; exception when insufficient_privilege then null; end;
  update dg_profile_guard_probe set full_name='Updated field name',organization='Updated school';
  if not exists(select 1 from dg_profile_guard_probe where role='user' and active=true and full_name='Updated field name') then raise exception 'FAIL: normal profile edit blocked'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.profiles where role='owner' limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
  if not public.is_owner() then raise exception 'FAIL: owner fixture missing'; end if;
  update dg_profile_guard_probe set role='admin',active=false;
  if not exists(select 1 from dg_profile_guard_probe where role='admin' and active=false) then raise exception 'FAIL: owner administration blocked'; end if;
end $$;
reset role;
select 'PASS: user role/active/id blocked; profile edit and owner administration allowed; real rows unchanged' as verification;
rollback;
