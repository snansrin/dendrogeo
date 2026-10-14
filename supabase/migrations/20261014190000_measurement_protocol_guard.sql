-- DG-MEASURE-LOCK-2026-10-06-FINAL
-- fingerprint: 4e48cf360622b5633e664618a8626756b3207cec8dd63a3158714e957eae3212
-- New measurements and changed dimensions must preserve raw girth and full DBH precision.
-- No historical row rewrite; status/metadata-only updates keep their original evidence.
begin;
set local lock_timeout = '5s';
create or replace function public.dg_diameter_from_girth(girth double precision)
returns double precision language sql immutable strict
set search_path = pg_catalog
as $$ select girth / pi(); $$;

create or replace function public.enforce_measurement_protocol()
returns trigger language plpgsql
set search_path = pg_catalog, public
as $$
declare derived double precision;
begin
  if tg_op = 'UPDATE' then
    if new.girth_cm is not distinct from old.girth_cm
      and new.dbh_cm is not distinct from old.dbh_cm then return new; end if;
    -- Existing rows without raw circumference cannot gain fabricated evidence.
    if new.girth_cm is null and old.girth_cm is null then return new; end if;
  end if;
  if new.girth_cm is null or new.girth_cm <= 0
    or new.girth_cm::text in ('NaN','Infinity','-Infinity') then
    raise exception 'MEASUREMENT_PROTOCOL: pozitif ve sonlu göğüs çevresi gereklidir.' using errcode='23514';
  end if;
  derived := public.dg_diameter_from_girth(new.girth_cm);
  if derived > 400 or new.dbh_cm is null or new.dbh_cm <= 0
    or new.dbh_cm::text in ('NaN','Infinity','-Infinity')
    or abs(new.dbh_cm-derived) > greatest(1e-12,abs(derived)*1e-12) then
    raise exception 'MEASUREMENT_PROTOCOL: DBH çevre / pi olmalı; hesap değeri yuvarlanamaz.' using errcode='23514';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_measurement_protocol on public.measurements;
create trigger trg_measurement_protocol before insert or update of girth_cm,dbh_cm
on public.measurements for each row execute function public.enforce_measurement_protocol();
revoke all on function public.enforce_measurement_protocol() from public;
commit;
