-- ════════════════════════════════════════════════════════════════════
-- 0002 · small fixes on top of 0001_init.sql
-- ════════════════════════════════════════════════════════════════════

-- Allow role / verification changes from the SQL editor and the service role (auth.uid() is null there),
-- so `update profiles set role = 'admin' ...` works. Signed-in non-admins are still blocked, and anon
-- requests can't reach this trigger because RLS only lets users update their own row.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.role <> old.role or new.verified <> old.verified) then
    raise exception 'Only admins can change role or verification';
  end if;
  return new;
end $$;

-- Ticket refs in notifications match the UI (MT-0117, see src/lib/format.ts ticketRef).
create or replace function public.ticket(p_ref bigint) returns text
language sql immutable as $$ select 'MT-' || lpad(p_ref::text, 4, '0') $$;
