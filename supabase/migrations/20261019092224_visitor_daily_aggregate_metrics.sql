-- Anonymous daily event totals: no IP, visitor identity, session key or raw URL.
create table if not exists public.site_metric_daily (
 day date not null,
 event text not null check(event in ('page_view','workspace_open','analysis_request')),
 page text not null check(page in ('home','home-en','inventory','carbon','landcover','parks','methods','methods-en','data','reports','about','privacy','notice','terms','contact','app-dash','app-measure','app-nav','app-map','app-projects','app-records','app-export','app-world')),
 source text not null check(source in ('direct','search','ai','social','telegram','referral','internal')),
 device text not null check(device in ('phone','desktop','tablet')),
 country text not null default 'ZZ' check(country ~ '^[A-Z]{2}$'),
 total bigint not null default 0 check(total>=0),
 primary key(day,event,page,source,device,country)
);
alter table public.site_metric_daily enable row level security;
revoke all on public.site_metric_daily from public,anon,authenticated;
grant select on public.site_metric_daily to authenticated;
grant select,insert,update,delete on public.site_metric_daily to service_role;
create policy site_metric_owner_read on public.site_metric_daily for select to authenticated
 using ((select private.is_owner()));

create or replace function public.record_site_metric_v1(p_event text,p_page text,p_source text,p_device text,p_country text)
returns void language plpgsql security invoker set search_path='' as $$
declare today date := (pg_catalog.now() at time zone 'Europe/Istanbul')::date;
begin
 insert into public.site_metric_daily(day,event,page,source,device,country,total)
 values(today,p_event,p_page,p_source,p_device,p_country,1)
 on conflict(day,event,page,source,device,country) do update set total=public.site_metric_daily.total+1;
 delete from public.site_metric_daily where day<today-400;
end;$$;
revoke all on function public.record_site_metric_v1(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_site_metric_v1(text,text,text,text,text) to service_role;

create or replace function public.get_site_metrics_v1(p_days integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare today date := (pg_catalog.now() at time zone 'Europe/Istanbul')::date;
result jsonb;
begin
 if not coalesce(private.is_owner(),false) then raise exception 'Owner access required' using errcode='42501'; end if;
 if p_days is null or p_days not in (1,7,30) then raise exception 'Unsupported reporting range' using errcode='22023'; end if;
 with observations as (select * from public.site_metric_daily where day between today-(p_days-1) and today),
 views as (select * from observations where event='page_view'),
 sources as(select source as key,sum(total)::bigint as total from views group by source),
 devices as(select device as key,sum(total)::bigint as total from views group by device),
 countries as(select country as key,sum(total)::bigint as total from views group by country),
 pages as(select page as key,sum(total)::bigint as total from views group by page),
 daily as(select day,sum(total) filter(where event='page_view') as views,sum(total) filter(where event='workspace_open') as workspaces,sum(total) filter(where event='analysis_request') as analyses from observations group by day)
 select jsonb_build_object('days',p_days,'timezone','Europe/Istanbul','from',today-(p_days-1),'to',today,
  'collected_from',(select min(day) from public.site_metric_daily),
  'totals',jsonb_build_object('page_views',coalesce((select sum(total) from observations where event='page_view'),0),'workspace_opens',coalesce((select sum(total) from observations where event='workspace_open'),0),'analysis_requests',coalesce((select sum(total) from observations where event='analysis_request'),0)),
  'sources',coalesce((select jsonb_agg(s order by total desc,key) from sources s),'[]'::jsonb),
  'devices',coalesce((select jsonb_agg(d order by total desc,key) from devices d),'[]'::jsonb),
  'countries',coalesce((select jsonb_agg(c order by total desc,key) from countries c),'[]'::jsonb),
  'pages',coalesce((select jsonb_agg(p order by total desc,key) from pages p),'[]'::jsonb),
  'daily',coalesce((select jsonb_agg(d order by day) from daily d),'[]'::jsonb)) into result;
 return result;
end;$$;
revoke all on function public.get_site_metrics_v1(integer) from public,anon;
grant execute on function public.get_site_metrics_v1(integer) to authenticated;
comment on table public.site_metric_daily is 'First-party daily totals only; no individual identifiers. Ingestion via service-role edge function; read access only for owner. 400-day retention.';
