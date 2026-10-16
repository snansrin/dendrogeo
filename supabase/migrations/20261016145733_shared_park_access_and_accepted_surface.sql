-- Self-service departure never accepts another user's ID and never removes research data.
create function private.dg_leave_park(p_park bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 delete from public.park_collaborators where park_id=p_park and user_id=auth.uid();
 get diagnostics changed = row_count;
 return changed>0;
end $$;
revoke all on function private.dg_leave_park(bigint) from public, anon;
grant execute on function private.dg_leave_park(bigint) to authenticated;
create function public.dg_leave_park(p_park bigint) returns boolean
language sql security invoker set search_path='' as $$ select private.dg_leave_park(p_park) $$;
revoke all on function public.dg_leave_park(bigint) from public, anon;
grant execute on function public.dg_leave_park(bigint) to authenticated;

-- A public, read-only cartographic snapshot. Drafts, owners and account payloads stay private.
create function private.dg_accepted_park_surface(p_park bigint) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('revision',sr.revision,'result',jsonb_build_object(
  'schema',a->'schema','parkId',a->'parkId','acceptedAt',a->'acceptedAt',
  'outer',a->'outer','holes',a->'holes','areas',a->'areas',
  'features',(select coalesce(jsonb_agg(jsonb_build_object('type','Feature','geometry',f->'geometry','properties',jsonb_build_object('class',f->'properties'->'class','area_m2',f->'properties'->'area_m2','method',f->'properties'->'method'))),'[]'::jsonb) from jsonb_array_elements(a->'features') f),
  'displayFeatures',(select coalesce(jsonb_agg(jsonb_build_object('type','Feature','geometry',f->'geometry','properties',jsonb_build_object('class',f->'properties'->'class'))),'[]'::jsonb) from jsonb_array_elements(a->'displayFeatures') f)))
 from public.surface_reviews sr
 join public.profiles p on p.id=sr.owner
 cross join lateral (select sr.payload->'acceptedResult' a) snapshot
 where sr.park_id=p_park and p.role in ('admin','owner')
  and a->>'schema'='dendrogeo-surface/2' and a->>'parkId'=p_park::text
  and nullif(a->>'acceptedAt','') is not null
  and jsonb_typeof(a->'features')='array' and jsonb_typeof(a->'displayFeatures')='array'
 order by a->>'acceptedAt' desc,sr.revision desc limit 1
$$;
revoke all on function private.dg_accepted_park_surface(bigint) from public;
grant execute on function private.dg_accepted_park_surface(bigint) to anon, authenticated;
create function public.dg_accepted_park_surface(p_park bigint) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.dg_accepted_park_surface(p_park) $$;
revoke all on function public.dg_accepted_park_surface(bigint) from public;
grant execute on function public.dg_accepted_park_surface(bigint) to anon, authenticated;
