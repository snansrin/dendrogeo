-- Protect transient visitor and park GPS streams with private Realtime channels.
-- Existing public channels and application tables are not modified.
set lock_timeout = '3s';
set statement_timeout = '30s';

-- The topic suffix is untrusted client input. Parse only bounded positive bigint
-- park IDs so malformed/oversized topic names cannot raise during RLS checks.
create or replace function private.dg_presence_park_topic_id(p_topic text)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case
    when p_topic ~ '^dg-park-[1-9][0-9]*$' and length(p_topic) <= 27 then
      case
        when substring(p_topic from 9)::numeric <= 9223372036854775807::numeric
          then substring(p_topic from 9)::bigint
      end
  end;
$$;
revoke all on function private.dg_presence_park_topic_id(text) from public, anon;
grant execute on function private.dg_presence_park_topic_id(text) to authenticated, service_role;

-- Keep privileged RPC bodies independent of mutable schema search_path.
alter function public.dg_invite_send(bigint,text,text) set search_path = '';
alter function public.dg_invite_respond(uuid,boolean) set search_path = '';
alter function public.dg_invite_revoke(bigint,text,text) set search_path = '';
alter function public.dg_is_park_member(bigint) set search_path = '';

drop policy if exists dg_presence_owner_read on realtime.messages;
create policy dg_presence_owner_read
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'presence'
  and (select realtime.topic()) = 'dg-presence'
  and (select private.is_active())
  and (select private.is_owner())
);

drop policy if exists dg_presence_active_publish on realtime.messages;
create policy dg_presence_active_publish
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension = 'presence'
  and (select realtime.topic()) = 'dg-presence'
  and (select private.is_active())
);

drop policy if exists dg_park_presence_member_read on realtime.messages;
create policy dg_park_presence_member_read
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'presence'
  and (select private.is_active())
  and (select public.dg_is_park_member(
    private.dg_presence_park_topic_id((select realtime.topic()))
  ))
);

drop policy if exists dg_park_presence_member_publish on realtime.messages;
create policy dg_park_presence_member_publish
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension = 'presence'
  and (select private.is_active())
  and (select public.dg_is_park_member(
    private.dg_presence_park_topic_id((select realtime.topic()))
  ))
);
