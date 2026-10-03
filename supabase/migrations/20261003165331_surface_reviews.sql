-- Private, versioned surface review snapshots. Original park/raster data is untouched.
create table if not exists public.surface_reviews (
 owner uuid not null references public.profiles(id) on delete cascade,
 park_id bigint not null references public.parks(id) on delete cascade,
 source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
 payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=8388608),
 revision integer not null default 1 check (revision>0),
 updated_at timestamptz not null default now(),
 primary key (owner,park_id),
 constraint surface_review_identity check ((payload->>'owner'=owner::text) is true and (payload->>'parkId'=park_id::text) is true and (payload->>'fingerprint'=source_fingerprint) is true)
);
alter table public.surface_reviews enable row level security;
revoke all on public.surface_reviews from anon;
grant select,insert,update on public.surface_reviews to authenticated;
do $$ begin if not exists (select 1 from pg_policies where schemaname='public' and tablename='surface_reviews' and policyname='surface_reviews_select') then create policy surface_reviews_select on public.surface_reviews for select to authenticated using ((select auth.uid())=owner); end if; end $$;
do $$ begin if not exists (select 1 from pg_policies where schemaname='public' and tablename='surface_reviews' and policyname='surface_reviews_insert') then create policy surface_reviews_insert on public.surface_reviews for insert to authenticated with check ((select auth.uid())=owner); end if; end $$;
do $$ begin if not exists (select 1 from pg_policies where schemaname='public' and tablename='surface_reviews' and policyname='surface_reviews_update') then create policy surface_reviews_update on public.surface_reviews for update to authenticated using ((select auth.uid())=owner) with check ((select auth.uid())=owner); end if; end $$;
comment on table public.surface_reviews is 'Per-user visual surface review snapshots with source geometry fingerprint; not independent satellite ground truth.';
