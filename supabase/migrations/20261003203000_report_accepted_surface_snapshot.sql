begin;

alter table public.report_requests
  add column if not exists surface_snapshot jsonb;

comment on column public.report_requests.surface_snapshot is
  'Yayın isteği anında sunucu tarafından dondurulan, kişisel geometri içermeyen kabul edilmiş yüzey sonucu. Doluysa with_lulc=false yapılarak raporun yeniden LULC üretmesi engellenir.';

create or replace function public.tg_report_request_gate() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
  recent int;
  quota constant int := 3;
  sr public.surface_reviews%rowtype;
  areas jsonb;
begin
  if public.is_admin() then
    null;
  else
    if new.requested_by is distinct from auth.uid() then
      raise exception 'REPORT_NOT_SELF (DGR0NS): yayın isteği yalnız kendi adına açılabilir'
        using errcode = 'DG0NS';
    end if;

    if not exists (
      select 1 from public.projects p
      where p.owner = auth.uid()
        and p.park_id = new.park_id
    ) then
      raise exception 'REPORT_NOT_YOUR_PARK (DGR0NP): park #% için projen yok — kullanıcılar yalnız kendi parkını yayınlayabilir', new.park_id
        using errcode = 'DG0NP';
    end if;

    if not exists (
      select 1
      from public.measurements m
      left join public.projects p2 on p2.id = m.project_id
      where m.owner = auth.uid()
        and m.status = 'Onaylı'
        and m.deleted_at is null
        and (m.park_id = new.park_id or p2.park_id = new.park_id)
    ) then
      raise exception 'REPORT_NO_OWN_DATA (DGR0ND): bu parkta onaylı ölçümün yok — ölçümlerin onaylanınca yayın isteyebilirsin'
        using errcode = 'DG0ND';
    end if;

    select count(*) into recent
    from public.report_requests r
    where r.requested_by = auth.uid()
      and r.created_at > now() - interval '24 hours';
    if recent >= quota then
      raise exception 'REPORT_QUOTA (DGR0QT): 24 saatlik yayın isteği sınırına (%) ulaşıldı — sonra yeniden dene', quota
        using errcode = 'DG0QT';
    end if;
  end if;

  select count(*) into n
  from public.measurements m
  where m.park_id = new.park_id
    and m.status = 'Onaylı'
    and m.deleted_at is null;

  if coalesce(n, 0) = 0 then
    raise exception 'REPORT_NO_DATA (DGR0RD): park #% için onaylı ölçüm yok — rapor üretilemez', new.park_id
      using errcode = '22023';
  end if;

  if tg_op = 'INSERT' then
    new.surface_snapshot := null;

    if new.requested_by is not null then
      select s.* into sr
      from public.surface_reviews s
      where s.park_id = new.park_id
        and s.owner = new.requested_by
        and jsonb_typeof(s.payload -> 'acceptedAreas') = 'object'
        and nullif(s.payload ->> 'acceptedAt', '') is not null
        and coalesce(s.payload ->> 'draftDirty', 'false') <> 'true'
      order by s.revision desc, s.updated_at desc
      limit 1;

      if found then
        areas := sr.payload -> 'acceptedAreas';
        new.surface_snapshot := jsonb_build_object(
          'schema', 'dendrogeo-surface-accepted/1',
          'revision', sr.revision,
          'source_fingerprint', sr.source_fingerprint,
          'object_fingerprint', nullif(sr.payload ->> 'objectFingerprint', ''),
          'accepted_at', sr.payload ->> 'acceptedAt',
          'areas_m2', jsonb_build_object(
            'green', case when jsonb_typeof(areas -> 'green') = 'number' then areas -> 'green' else '0'::jsonb end,
            'hard', case when jsonb_typeof(areas -> 'hard') = 'number' then areas -> 'hard' else '0'::jsonb end,
            'building', case when jsonb_typeof(areas -> 'building') = 'number' then areas -> 'building' else '0'::jsonb end,
            'water', case when jsonb_typeof(areas -> 'water') = 'number' then areas -> 'water' else '0'::jsonb end,
            'pool', case when jsonb_typeof(areas -> 'pool') = 'number' then areas -> 'pool' else '0'::jsonb end,
            'bare', case when jsonb_typeof(areas -> 'bare') = 'number' then areas -> 'bare' else '0'::jsonb end,
            'other', case when jsonb_typeof(areas -> 'other') = 'number' then areas -> 'other' else '0'::jsonb end
          )
        );
        new.with_lulc := false;
      end if;
    end if;
  end if;

  return new;
end
$$;

commit;
