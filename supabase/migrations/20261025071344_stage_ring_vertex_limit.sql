-- Preserve detailed parent boundaries; change only the bounded stage-ring vertex cap.
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
 if n<4 or n>1001 or r->0<>r->(n-1) then return false; end if;
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


revoke all on function public.dg_stage_valid_ring(jsonb) from public,anon;
grant execute on function public.dg_stage_valid_ring(jsonb) to authenticated;
