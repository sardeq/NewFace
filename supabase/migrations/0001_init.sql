-- ════════════════════════════════════════════════════════════════════
-- Mend · civic infrastructure reporting + crowdfunding
-- Supabase schema, RLS, triggers and RPCs.
-- Run with:  supabase db push    (or paste into the SQL editor)
-- ════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ───────── enums ─────────
create type public.role_t as enum ('citizen', 'admin', 'contractor');
create type public.issue_status_t as enum
  ('pending_review', 'open_for_funding', 'assigned', 'in_progress', 'resolved', 'rejected');
create type public.category_t as enum
  ('roads', 'lighting', 'water', 'sidewalks', 'signage', 'drainage', 'parks', 'other');
create type public.bid_status_t as enum ('pending', 'approved', 'rejected', 'withdrawn');

-- ───────── tables ─────────
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null default '',
  handle      text unique,
  role        public.role_t not null default 'citizen',
  district    text not null default '',
  hue         int  not null default (floor(random() * 360))::int,
  company     text,
  verified    boolean not null default false,
  joined_at   timestamptz not null default now()
);

create table public.issues (
  id               uuid primary key default gen_random_uuid(),
  ref              bigint generated always as identity (start with 100),
  author_id        uuid not null references public.profiles on delete cascade,
  title            text not null check (char_length(title) between 3 and 120),
  description      text not null check (char_length(description) between 3 and 2000),
  category         public.category_t not null default 'other',
  severity         int not null default 3 check (severity between 1 and 5),
  status           public.issue_status_t not null default 'pending_review',
  lat              double precision not null,
  lng              double precision not null,
  accuracy         int,
  address          text not null default '',
  district         text not null default '',
  photos           text[] not null default '{}',
  estimated_cost   numeric(12,2) check (estimated_cost is null or estimated_cost >= 0),
  ai               jsonb,
  cost_check       jsonb,
  verified_by      text check (verified_by in ('ai', 'admin')),
  rejection_reason text,
  assigned_bid_id  uuid,
  story_id         uuid,
  -- denormalised counters (maintained by triggers)
  upvotes          int not null default 0,
  downvotes        int not null default 0,
  comment_count    int not null default 0,
  raised           numeric(12,2) not null default 0,
  donor_count      int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index issues_status_idx on public.issues (status, created_at desc);
create index issues_author_idx on public.issues (author_id);

create table public.votes (
  issue_id  uuid references public.issues on delete cascade,
  user_id   uuid references public.profiles on delete cascade,
  value     smallint not null check (value in (-1, 1)),
  primary key (issue_id, user_id)
);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  issue_id    uuid not null references public.issues on delete cascade,
  author_id   uuid not null references public.profiles on delete cascade,
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index comments_issue_idx on public.comments (issue_id, created_at);

create table public.donations (
  id          uuid primary key default gen_random_uuid(),
  issue_id    uuid not null references public.issues on delete restrict,
  user_id     uuid not null references public.profiles on delete restrict,
  amount      numeric(12,2) not null check (amount > 0),
  anonymous   boolean not null default false,
  method      text not null default 'card',
  reference   text not null unique,
  status      text not null default 'succeeded' check (status in ('pending', 'succeeded', 'refunded')),
  created_at  timestamptz not null default now()
);
create index donations_issue_idx on public.donations (issue_id);
create index donations_user_idx on public.donations (user_id);

create table public.bids (
  id             uuid primary key default gen_random_uuid(),
  issue_id       uuid not null references public.issues on delete cascade,
  contractor_id  uuid not null references public.profiles on delete cascade,
  amount         numeric(12,2) not null check (amount > 0),
  days           int not null check (days between 1 and 365),
  message        text not null check (char_length(message) between 10 and 2000),
  status         public.bid_status_t not null default 'pending',
  ai             jsonb,
  decided_at     timestamptz,
  decision_note  text,
  "authorization" text,
  created_at     timestamptz not null default now()
);
create unique index one_pending_bid_per_contractor
  on public.bids (issue_id, contractor_id) where status = 'pending';

alter table public.issues
  add constraint issues_assigned_bid_fk foreign key (assigned_bid_id) references public.bids on delete set null;

create table public.status_events (
  id        uuid primary key default gen_random_uuid(),
  issue_id  uuid not null references public.issues on delete cascade,
  status    public.issue_status_t not null,
  note      text not null default '',
  actor_id  uuid references public.profiles on delete set null,
  at        timestamptz not null default now()
);
create index status_events_issue_idx on public.status_events (issue_id, at);

create table public.stories (
  id             uuid primary key default gen_random_uuid(),
  issue_id       uuid not null unique references public.issues on delete cascade,
  after_photos   text[] not null default '{}',
  summary        text not null,
  final_cost     numeric(12,2) not null default 0,
  days_to_fix    int not null default 0,
  contractor_id  uuid references public.profiles on delete set null,
  created_at     timestamptz not null default now()
);
alter table public.issues
  add constraint issues_story_fk foreign key (story_id) references public.stories on delete set null;

create table public.notifications (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles on delete cascade,
  kind      text not null,
  title     text not null,
  body      text not null default '',
  link      text not null default '/',
  read      boolean not null default false,
  at        timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, at desc);

-- ───────── helpers ─────────
create or replace function public.my_role() returns public.role_t
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.ticket(p_ref bigint) returns text
language sql immutable as $$ select 'MN-' || lpad(p_ref::text, 4, '0') $$;

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link)
$$;
revoke execute on function public.notify from public, anon, authenticated;

-- ───────── auth → profile ─────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, name, handle, role, district, company)
  values (
    new.id,
    coalesce(meta->>'name', split_part(new.email, '@', 1)),
    coalesce(meta->>'handle', split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4)),
    -- self sign-up can only be citizen or (unverified) contractor; admins are promoted manually
    case when meta->>'account_type' = 'contractor' then 'contractor'::public.role_t else 'citizen'::public.role_t end,
    coalesce(meta->>'district', ''),
    meta->>'company'
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may edit their profile, but never their own role / verification.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and (new.role <> old.role or new.verified <> old.verified) then
    raise exception 'Only admins can change role or verification';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile();

-- ───────── issues triggers ─────────
-- New reports always start unverified; Gemma (edge function, service role) or an admin verifies.
create or replace function public.issues_before_insert() returns trigger
language plpgsql as $$
begin
  if auth.role() <> 'service_role' then
    new.status := 'pending_review';
    new.verified_by := null;
    new.estimated_cost := null;
    new.cost_check := null;
    new.assigned_bid_id := null;
    new.story_id := null;
    new.upvotes := 0; new.downvotes := 0; new.comment_count := 0; new.raised := 0; new.donor_count := 0;
  end if;
  return new;
end $$;
create trigger issues_bi before insert on public.issues
  for each row execute function public.issues_before_insert();

create or replace function public.issues_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.status_events (issue_id, status, note, actor_id)
  values (new.id, new.status, 'Report received.', new.author_id);
  insert into public.votes (issue_id, user_id, value) values (new.id, new.author_id, 1);
  return new;
end $$;
create trigger issues_ai after insert on public.issues
  for each row execute function public.issues_after_insert();

create or replace function public.issues_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger issues_touch before update on public.issues
  for each row execute function public.issues_touch();

-- ───────── counters ─────────
create or replace function public.refresh_issue_counters(p_issue uuid) returns void
language sql security definer set search_path = public as $$
  update public.issues i set
    upvotes       = (select count(*) from public.votes v where v.issue_id = p_issue and v.value = 1),
    downvotes     = (select count(*) from public.votes v where v.issue_id = p_issue and v.value = -1),
    comment_count = (select count(*) from public.comments c where c.issue_id = p_issue),
    raised        = (select coalesce(sum(amount), 0) from public.donations d where d.issue_id = p_issue and d.status = 'succeeded'),
    donor_count   = (select count(distinct user_id) from public.donations d where d.issue_id = p_issue and d.status = 'succeeded')
  where i.id = p_issue
$$;

create or replace function public.counters_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_issue_counters(coalesce(new.issue_id, old.issue_id));
  return null;
end $$;
create trigger votes_counters after insert or update or delete on public.votes
  for each row execute function public.counters_trigger();
create trigger comments_counters after insert or delete on public.comments
  for each row execute function public.counters_trigger();
create trigger donations_counters after insert or update on public.donations
  for each row execute function public.counters_trigger();

create or replace function public.comment_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare i public.issues; who text;
begin
  select * into i from public.issues where id = new.issue_id;
  select name into who from public.profiles where id = new.author_id;
  if i.author_id <> new.author_id then
    perform public.notify(i.author_id, 'comment', who || ' commented on ' || public.ticket(i.ref),
      left(new.body, 90), '/issue/' || i.id);
  end if;
  return new;
end $$;
create trigger comments_notify after insert on public.comments
  for each row execute function public.comment_notify();

-- ───────── RPCs ─────────
create or replace function public.cast_vote(p_issue uuid, p_value int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to vote'; end if;
  if p_value = 0 then
    delete from public.votes where issue_id = p_issue and user_id = auth.uid();
  elsif p_value in (-1, 1) then
    insert into public.votes (issue_id, user_id, value) values (p_issue, auth.uid(), p_value)
    on conflict (issue_id, user_id) do update set value = excluded.value;
  else
    raise exception 'Invalid vote';
  end if;
end $$;

-- Admin edits + optional status change with a note for the public timeline.
create or replace function public.admin_update_issue(p_issue uuid, p_patch jsonb, p_note text default '')
returns public.issues language plpgsql security definer set search_path = public as $$
declare i public.issues; new_status public.issue_status_t;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into i from public.issues where id = p_issue for update;
  new_status := coalesce((p_patch->>'status')::public.issue_status_t, i.status);

  update public.issues set
    title            = coalesce(p_patch->>'title', title),
    category         = coalesce((p_patch->>'category')::public.category_t, category),
    severity         = coalesce((p_patch->>'severity')::int, severity),
    estimated_cost   = case when p_patch ? 'estimatedCost' then (p_patch->>'estimatedCost')::numeric else estimated_cost end,
    cost_check       = case when p_patch ? 'costCheck' then p_patch->'costCheck' else cost_check end,
    rejection_reason = case when p_patch ? 'rejectionReason' then p_patch->>'rejectionReason' else rejection_reason end,
    verified_by      = case
                         when p_patch ? 'verifiedBy' then p_patch->>'verifiedBy'
                         when new_status not in ('pending_review', 'rejected') and verified_by is null then 'admin'
                         else verified_by end,
    status           = new_status
  where id = p_issue
  returning * into i;

  if new_status is distinct from (select status from public.status_events where issue_id = p_issue order by at desc limit 1)
     or coalesce(p_note, '') <> '' then
    insert into public.status_events (issue_id, status, note, actor_id) values (p_issue, new_status, coalesce(p_note, ''), auth.uid());
  end if;
  if p_patch ? 'status' then
    perform public.notify(i.author_id, 'status', public.ticket(i.ref) || ' status changed', coalesce(nullif(p_note, ''), i.title), '/issue/' || i.id);
  end if;
  return i;
end $$;

-- Donation logging. In production call this from the payment provider webhook
-- (service role) after the charge succeeds instead of from the browser.
create or replace function public.donate(p_issue uuid, p_amount numeric, p_anonymous boolean, p_method text)
returns public.donations language plpgsql security definer set search_path = public as $$
declare d public.donations; i public.issues;
begin
  if auth.uid() is null then raise exception 'Sign in to donate'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then raise exception 'Invalid amount'; end if;
  select * into i from public.issues where id = p_issue;
  if i.status not in ('open_for_funding', 'assigned', 'in_progress') then
    raise exception 'This issue is not accepting donations';
  end if;
  insert into public.donations (issue_id, user_id, amount, anonymous, method, reference)
  values (p_issue, auth.uid(), round(p_amount, 2), coalesce(p_anonymous, false), coalesce(p_method, 'card'),
          'TX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)))
  returning * into d;
  if i.author_id <> auth.uid() then
    perform public.notify(i.author_id, 'donation', 'New donation on ' || public.ticket(i.ref),
      'JOD ' || d.amount::text, '/issue/' || i.id);
  end if;
  return d;
end $$;

create or replace function public.withdraw_bid(p_bid uuid) returns public.bids
language plpgsql security definer set search_path = public as $$
declare b public.bids;
begin
  update public.bids set status = 'withdrawn'
  where id = p_bid and contractor_id = auth.uid() and status = 'pending'
  returning * into b;
  if b.id is null then raise exception 'Only your pending bids can be withdrawn'; end if;
  return b;
end $$;

create or replace function public.decide_bid(p_bid uuid, p_approve boolean, p_note text default '')
returns public.bids language plpgsql security definer set search_path = public as $$
declare b public.bids; i public.issues; o record; comp text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into b from public.bids where id = p_bid for update;
  if b.status <> 'pending' then raise exception 'Bid already decided'; end if;
  select * into i from public.issues where id = b.issue_id for update;

  if p_approve then
    if i.assigned_bid_id is not null then raise exception 'Issue already awarded'; end if;
    update public.bids set status = 'approved', decided_at = now(), decision_note = nullif(p_note, ''),
      "authorization" = 'WA-' || lpad(i.ref::text, 4, '0') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4))
    where id = p_bid returning * into b;
    select coalesce(company, name) into comp from public.profiles where id = b.contractor_id;
    update public.issues set assigned_bid_id = b.id, status = 'assigned' where id = i.id;
    insert into public.status_events (issue_id, status, note, actor_id)
      values (i.id, 'assigned', 'Work authorised for ' || comp || '.', auth.uid());
    perform public.notify(b.contractor_id, 'bid_approved', 'Work authorised · ' || public.ticket(i.ref),
      'Authorisation ' || b."authorization" || '. You may begin physical work.', '/contractor?tab=orders');
    perform public.notify(i.author_id, 'status', public.ticket(i.ref) || ' has a contractor', comp || ' will carry out the repair.', '/issue/' || i.id);
    for o in select * from public.bids where issue_id = i.id and id <> b.id and status = 'pending' loop
      update public.bids set status = 'rejected', decided_at = now(), decision_note = 'Another bid was selected.' where id = o.id;
      perform public.notify(o.contractor_id, 'bid_rejected', 'Bid not selected · ' || public.ticket(i.ref), 'Another contractor was awarded this job.', '/contractor');
    end loop;
  else
    update public.bids set status = 'rejected', decided_at = now(), decision_note = nullif(p_note, '')
    where id = p_bid returning * into b;
    perform public.notify(b.contractor_id, 'bid_rejected', 'Bid declined · ' || public.ticket(i.ref),
      coalesce(nullif(p_note, ''), 'The municipal desk declined this bid.'), '/contractor?tab=bids');
  end if;
  return b;
end $$;

create or replace function public.start_work(p_issue uuid, p_note text default '') returns public.issues
language plpgsql security definer set search_path = public as $$
declare i public.issues; b public.bids;
begin
  select * into i from public.issues where id = p_issue for update;
  select * into b from public.bids where id = i.assigned_bid_id;
  if not public.is_admin() and (b.contractor_id is distinct from auth.uid()) then
    raise exception 'You are not authorised on this job';
  end if;
  if i.status <> 'assigned' then raise exception 'Job is not in the assigned state'; end if;
  update public.issues set status = 'in_progress' where id = p_issue returning * into i;
  insert into public.status_events (issue_id, status, note, actor_id) values (p_issue, 'in_progress', coalesce(nullif(p_note, ''), 'Crew on site.'), auth.uid());
  perform public.notify(i.author_id, 'status', public.ticket(i.ref) || ' — work started', coalesce(nullif(p_note, ''), 'Crew on site.'), '/issue/' || i.id);
  return i;
end $$;

create or replace function public.resolve_issue(p_issue uuid, p_after text[], p_summary text, p_final_cost numeric)
returns public.stories language plpgsql security definer set search_path = public as $$
declare i public.issues; s public.stories; b public.bids; donor uuid;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into i from public.issues where id = p_issue for update;
  select * into b from public.bids where id = i.assigned_bid_id;
  insert into public.stories (issue_id, after_photos, summary, final_cost, days_to_fix, contractor_id)
  values (p_issue, coalesce(p_after, '{}'), p_summary, coalesce(p_final_cost, 0),
          greatest(1, extract(day from now() - i.created_at)::int), b.contractor_id)
  returning * into s;
  update public.issues set status = 'resolved', story_id = s.id where id = p_issue;
  insert into public.status_events (issue_id, status, note, actor_id)
    values (p_issue, 'resolved', 'Repair verified. Success story published.', auth.uid());
  perform public.notify(i.author_id, 'story', 'Fixed: ' || i.title, 'Your report became a success story.', '/stories/' || s.id);
  for donor in select distinct user_id from public.donations where issue_id = p_issue loop
    perform public.notify(donor, 'story', 'Fixed: ' || i.title, 'A repair you helped fund is complete.', '/stories/' || s.id);
  end loop;
  if b.contractor_id is not null then
    perform public.notify(b.contractor_id, 'story', 'Job signed off · ' || public.ticket(i.ref), 'The municipal desk verified your work.', '/stories/' || s.id);
  end if;
  return s;
end $$;

create or replace function public.share_issue(p_issue uuid, p_to uuid, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare i public.issues; who text;
begin
  if auth.uid() is null then raise exception 'Sign in to share'; end if;
  select * into i from public.issues where id = p_issue;
  select name into who from public.profiles where id = auth.uid();
  perform public.notify(p_to, 'share', who || ' sent you ' || public.ticket(i.ref), coalesce(nullif(p_note, ''), i.title), '/issue/' || i.id);
end $$;

create or replace function public.city_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'reported',       (select count(*) from public.issues where status <> 'rejected'),
    'resolved',       (select count(*) from public.issues where status = 'resolved'),
    'raised',         (select coalesce(sum(amount), 0) from public.donations where status = 'succeeded'),
    'openForFunding', (select count(*) from public.issues where status = 'open_for_funding'),
    'avgDaysToFix',   (select coalesce(round(avg(days_to_fix)), 0) from public.stories)
  )
$$;

-- Public, anonymity-respecting donation ledger (runs as owner, hides anonymous donors).
create or replace view public.donation_ledger as
  select id, issue_id, case when anonymous then null else user_id end as user_id,
         amount, anonymous, method, reference, created_at
  from public.donations where status = 'succeeded';

-- ───────── RLS ─────────
alter table public.profiles      enable row level security;
alter table public.issues        enable row level security;
alter table public.votes         enable row level security;
alter table public.comments      enable row level security;
alter table public.donations     enable row level security;
alter table public.bids          enable row level security;
alter table public.status_events enable row level security;
alter table public.stories       enable row level security;
alter table public.notifications enable row level security;

create policy "profiles readable"  on public.profiles for select using (true);
create policy "edit own profile"   on public.profiles for update using (id = auth.uid() or public.is_admin());

create policy "public issues readable" on public.issues for select using (
  (verified_by is not null and status <> 'rejected') or author_id = auth.uid() or public.is_admin()
);
create policy "citizens report" on public.issues for insert with check (author_id = auth.uid());
create policy "admins edit issues" on public.issues for update using (public.is_admin());

create policy "read own votes" on public.votes for select using (user_id = auth.uid());

create policy "comments readable" on public.comments for select using (true);
create policy "comment as self"   on public.comments for insert with check (author_id = auth.uid());
create policy "delete own comment" on public.comments for delete using (author_id = auth.uid() or public.is_admin());

create policy "own donations"     on public.donations for select using (user_id = auth.uid() or public.is_admin());

create policy "bids readable"     on public.bids for select using (auth.uid() is not null);
create policy "contractors bid"   on public.bids for insert with check (
  contractor_id = auth.uid() and public.my_role() = 'contractor' and status = 'pending' and ai is null
);

create policy "timeline readable" on public.status_events for select using (true);
create policy "stories readable"  on public.stories for select using (true);

create policy "own notifications"        on public.notifications for select using (user_id = auth.uid());
create policy "mark own notifications"   on public.notifications for update using (user_id = auth.uid());

grant select on public.donation_ledger to anon, authenticated;

-- ───────── storage ─────────
insert into storage.buckets (id, name, public) values ('issue-media', 'issue-media', true)
on conflict (id) do nothing;

create policy "media public read" on storage.objects for select using (bucket_id = 'issue-media');
create policy "media upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'issue-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────── realtime ─────────
alter publication supabase_realtime add table public.issues, public.comments, public.notifications;
