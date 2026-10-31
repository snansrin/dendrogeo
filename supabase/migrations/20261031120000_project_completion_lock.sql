-- Project-scoped completion seal. Existing projects remain active by default.
-- Never derive the seal from a park name: multiple studies may share one park.
alter table public.projects add column if not exists is_locked boolean not null default false;
alter table public.projects add column if not exists locked_at timestamptz;
alter table public.projects add column if not exists locked_by uuid references auth.users(id);

create or replace function private.dg_project_mutation_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_project_id bigint;
begin
  if TG_TABLE_NAME = 'projects' then
    if TG_OP = 'INSERT' then
      if NEW.is_locked then raise exception 'PROJECT_MUST_START_ACTIVE' using errcode = '23514'; end if;
      NEW.locked_at := null; NEW.locked_by := null;
      return NEW;
    end if;
    if TG_OP = 'DELETE' then
      if OLD.is_locked then raise exception 'PROJECT_LOCKED' using errcode = '23514'; end if;
      return OLD;
    end if;
    if TG_OP = 'UPDATE' then
      if OLD.is_locked and (to_jsonb(NEW) - 'is_locked' - 'locked_at' - 'locked_by')
                           is distinct from (to_jsonb(OLD) - 'is_locked' - 'locked_at' - 'locked_by') then
        raise exception 'PROJECT_LOCKED' using errcode = '23514';
      end if;
      if NEW.is_locked is distinct from OLD.is_locked then
        if (to_jsonb(NEW) - 'is_locked' - 'locked_at' - 'locked_by')
             is distinct from (to_jsonb(OLD) - 'is_locked' - 'locked_at' - 'locked_by') then
          raise exception 'PROJECT_LOCK_CHANGE_MUST_BE_SEPARATE' using errcode = '23514';
        end if;
        if auth.uid() is null or not (OLD.owner = auth.uid() or private.is_admin()) then
          raise exception 'PROJECT_LOCK_PERMISSION_DENIED' using errcode = '42501';
        end if;
        NEW.locked_at := case when NEW.is_locked then now() else null end;
        NEW.locked_by := case when NEW.is_locked then auth.uid() else null end;
      elsif NEW.locked_at is distinct from OLD.locked_at or NEW.locked_by is distinct from OLD.locked_by then
        raise exception 'PROJECT_LOCK_METADATA_IMMUTABLE' using errcode = '42501';
      end if;
    end if;
    return NEW;
  end if;

  if TG_OP = 'DELETE' then v_project_id := OLD.project_id;
  else v_project_id := NEW.project_id; end if;
  if v_project_id is not null and exists(select 1 from public.projects where id = v_project_id and is_locked) then
    raise exception 'PROJECT_LOCKED' using errcode = '23514';
  end if;
  if TG_OP = 'UPDATE' and OLD.project_id is distinct from NEW.project_id
     and OLD.project_id is not null
     and exists(select 1 from public.projects where id = OLD.project_id and is_locked) then
    raise exception 'PROJECT_LOCKED' using errcode = '23514';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $$;

drop trigger if exists dg_project_completion_guard on public.projects;
create trigger dg_project_completion_guard before insert or update or delete on public.projects
for each row execute function private.dg_project_mutation_guard();
drop trigger if exists dg_measurement_completion_guard on public.measurements;
create trigger dg_measurement_completion_guard before insert or update or delete on public.measurements
for each row execute function private.dg_project_mutation_guard();
drop trigger if exists dg_waypoint_completion_guard on public.waypoints;
create trigger dg_waypoint_completion_guard before insert or update or delete on public.waypoints
for each row execute function private.dg_project_mutation_guard();
