-- Additive, opt-in scopes. No backfill, reparenting, old-row update or deletion.
create or replace function public.dg_stage_valid_ring(r jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare n integer; i integer; j integer; a jsonb; b jsonb; c jsonb; d jsonb;
 ax double precision; ay double precision; bx double precision; by_ double precision;
 cx double precision; cy double precision; dx double precision; dy double precision;
 u double precision; v double precision; w double precision; z double precision; area double precision:=0;
begin
 if jsonb_typeof(r) is distinct from 'array' then return false; end if;
 n:=jsonb_array_length(r);
 if n<4 or n>301 or r->0<>r->(n-1) then return false; end if;
 for i in 0..n-1 loop
  a:=r->i;
  if jsonb_typeof(a) is distinct from 'array' or jsonb_array_length(a)<>2 then return false; end if;
  if jsonb_typeof(a->0)<>'number' or jsonb_typeof(a->1)<>'number' then return false; end if;
  if abs((a->>0)::double precision)>90 or abs((a->>1)::double precision)>180 then return false; end if;
 end loop;
 for i in 0..n-2 loop
  a:=r->i;b:=r->(i+1); ax:=(a->>0)::double precision;ay:=(a->>1)::double precision;
  bx:=(b->>0)::double precision;by_:=(b->>1)::double precision;
  if a=b then return false; end if;
  area:=area+ay*bx-by_*ax;
  for j in i+1..n-2 loop
   if j=i+1 or (i=0 and j=n-2) then continue; end if;
   c:=r->j;d:=r->(j+1);cx:=(c->>0)::double precision;cy:=(c->>1)::double precision;
   dx:=(d->>0)::double precision;dy:=(d->>1)::double precision;
   u:=(bx-ax)*(cy-ay)-(by_-ay)*(cx-ax);v:=(bx-ax)*(dy-ay)-(by_-ay)*(dx-ax);
   w:=(dx-cx)*(ay-cy)-(dy-cy)*(ax-cx);z:=(dx-cx)*(by_-cy)-(dy-cy)*(bx-cx);
   if (u*v<0 and w*z<0) or
    (abs(u)<1e-14 and cx between least(ax,bx) and greatest(ax,bx) and cy between least(ay,by_) and greatest(ay,by_)) or
    (abs(v)<1e-14 and dx between least(ax,bx) and greatest(ax,bx) and dy between least(ay,by_) and greatest(ay,by_)) or
    (abs(w)<1e-14 and ax between least(cx,dx) and greatest(cx,dx) and ay between least(cy,dy) and greatest(cy,dy)) or
    (abs(z)<1e-14 and bx between least(cx,dx) and greatest(cx,dx) and by_ between least(cy,dy) and greatest(cy,dy)) then return false; end if;
  end loop;
 end loop;
 return abs(area)>1e-12;
exception when others then return false;
end $$;

create or replace function public.dg_create_park_stage(p_parent bigint,p_name text,p_geometry jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare parent public.parks; stage public.parks; g jsonb; r jsonb; pt jsonb; prev jsonb;
 k text; n text; total double precision:=0; ring_area double precision; sign_ integer;
 lat_ double precision:=0;lon_ double precision:=0;count_ integer:=0;
begin
 if auth.uid() is null then raise exception 'STAGE_AUTH_REQUIRED' using errcode='42501'; end if;
 select * into parent from public.parks where id=p_parent;
 if parent.id is null or parent.osm_key like 'stage/%' then raise exception 'STAGE_PARENT_REQUIRED'; end if;
 n:=btrim(p_name);
 if n is null or length(n)<1 or length(n)>80 then raise exception 'STAGE_NAME_REQUIRED'; end if;
 if jsonb_typeof(p_geometry->'outer') is distinct from 'array' or jsonb_typeof(p_geometry->'inner') is distinct from 'array'
  or jsonb_array_length(p_geometry->'outer')<1 or jsonb_array_length(p_geometry->'outer')>20
  or jsonb_array_length(p_geometry->'inner')>40 or octet_length(p_geometry::text)>180000 then raise exception 'STAGE_GEOMETRY_REQUIRED'; end if;
 g:=jsonb_build_object('outer',p_geometry->'outer','inner',p_geometry->'inner');
 for sign_ in 0..1 loop
  for r in select value from jsonb_array_elements(g->case when sign_=0 then 'outer' else 'inner' end) loop
   if not public.dg_stage_valid_ring(r) then raise exception 'STAGE_INVALID_RING'; end if;
   ring_area:=0;prev:=r->0;
   for pt in select value from jsonb_array_elements(r) loop
    ring_area:=ring_area+radians((pt->>1)::double precision-(prev->>1)::double precision)*(2+sin(radians((prev->>0)::double precision))+sin(radians((pt->>0)::double precision)));
    prev:=pt;
    if sign_=0 then lat_:=lat_+(pt->>0)::double precision;lon_:=lon_+(pt->>1)::double precision;count_:=count_+1;end if;
   end loop;
   total:=total+(case when sign_=0 then 1 else -1 end)*abs(ring_area*6378137.0^2/2);
  end loop;
 end loop;
 if total<1 then raise exception 'STAGE_AREA_TOO_SMALL'; end if;
 k:='stage/'||p_parent||'/'||md5(n||g::text);
 g:=g||jsonb_build_object('stage_scope',jsonb_build_object('schema','dendrogeo/park-stage/1','parentId',p_parent,'parentKey',parent.osm_key,'parentName',parent.name,'label',n,'definition','user-defined','revision',1));
 insert into public.parks(osm_key,osm_type,name,name_norm,source,created_by,centroid_lat,centroid_lon,area_m2,geom_json,country,city)
 values(k,'manual',parent.name||' · '||n||' (kullanıcı tanımlı etap)',lower(parent.name||' '||n),'manual',auth.uid(),lat_/count_,lon_/count_,total,g,parent.country,parent.city)
 on conflict (osm_key) do nothing;
 select * into stage from public.parks where osm_key=k;
 if stage.id is null then raise exception 'STAGE_WRITE_FAILED'; end if;
 return to_jsonb(stage);
end $$;

-- Existing scopes retain their legacy geofence policy. Stage scopes are exact.
create or replace function public.dg_guard_stage_measurement() returns trigger
language plpgsql security invoker set search_path='' as $$
declare project_park bigint; p public.parks;
begin
 select park_id into project_park from public.projects where id=new.project_id;
 select * into p from public.parks where id=coalesce(project_park,new.park_id);
 if p.id is null or p.osm_key not like 'stage/%' then
  select * into p from public.parks where id=new.park_id;
  if p.osm_key not like 'stage/%' or p.id is null then return new; end if;
 end if;
 if project_park is distinct from p.id or new.park_id is distinct from p.id then raise exception 'STAGE_PROJECT_MISMATCH' using errcode='23514';end if;
 if new.lat is null or new.lon is null or not(new.lat between -90 and 90 and new.lon between -180 and 180) or not coalesce(public.dg_point_in_park(new.lat,new.lon,p.geom_json),false) then
  raise exception 'STAGE_OUTSIDE: ölçüm seçili etabın dışında' using errcode='23514';end if;
 return new;
end $$;
drop trigger if exists zzz_stage_measurement_scope on public.measurements;
create trigger zzz_stage_measurement_scope before insert or update of lat,lon,park_id,project_id on public.measurements
 for each row execute function public.dg_guard_stage_measurement();

create or replace function public.dg_guard_stage_park() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if old.osm_key like 'stage/%' and (old.osm_key is distinct from new.osm_key or old.geom_json is distinct from new.geom_json) then
  raise exception 'STAGE_IMMUTABLE: sınır değişikliği için yeni etap oluşturun' using errcode='23514';end if;
 return new;
end $$;
drop trigger if exists stage_scope_immutable on public.parks;
create trigger stage_scope_immutable before update of osm_key,geom_json on public.parks for each row execute function public.dg_guard_stage_park();

create or replace function public.dg_guard_stage_project() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if old.park_id is distinct from new.park_id and exists(select 1 from public.parks where id in(old.park_id,new.park_id) and osm_key like 'stage/%') then
  raise exception 'STAGE_NEW_PROJECT_REQUIRED: etap için ayrı proje oluşturun' using errcode='23514';end if;
 return new;
end $$;
drop trigger if exists stage_project_scope on public.projects;
create trigger stage_project_scope before update of park_id on public.projects for each row execute function public.dg_guard_stage_project();

create or replace function public.dg_park_stage_ready() returns integer language sql immutable security invoker set search_path='' as $$select 1$$;
revoke all on function public.dg_create_park_stage(bigint,text,jsonb),public.dg_park_stage_ready(),public.dg_stage_valid_ring(jsonb),public.dg_guard_stage_measurement(),public.dg_guard_stage_park(),public.dg_guard_stage_project() from public,anon;
grant execute on function public.dg_create_park_stage(bigint,text,jsonb),public.dg_park_stage_ready(),public.dg_stage_valid_ring(jsonb),public.dg_guard_stage_measurement(),public.dg_guard_stage_park(),public.dg_guard_stage_project() to authenticated;
