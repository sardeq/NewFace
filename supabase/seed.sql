-- ════════════════════════════════════════════════════════════════════
-- Matab · seed data for a fresh project (Amman)
--
-- Run AFTER migrations/0001_init.sql (and 0002_fixes.sql), in the Supabase SQL editor
-- or with `supabase db reset` locally. Safe to re-run: it removes the previous seed first.
--
-- Creates 9 confirmed accounts. Every account uses the password:  MatabDemo#2026
--   citizens     lina@matab.test  omar@matab.test  rana@matab.test  yazan@matab.test  noor@matab.test
--   admin        desk@matab.test          (Hala Qasem · municipal desk)
--   contractors  nabulsi@matab.test       (Nabulsi Paving Co., verified)
--                sahel@matab.test         (Sahel Electric, verified)
--                quickfix@matab.test      (QuickFix Handyman, not verified)
--
-- …plus 13 reports across every stage of the lifecycle, bids, donations, comments, votes,
-- timeline events, 3 success stories and a few notifications.
--
-- Photos: each report / story points at an image in the `issue-media` bucket under the desk
-- account's folder. Put your images in supabase/seed-photos/ and run
--   node scripts/upload-seed-photos.mjs
-- after this file (the list of file names is in supabase/seed-photos/README.md).
--
-- Seed ids are fixed so re-runs replace them cleanly:
--   users a1000000-…, issues b1000000-…, bids c1000000-…, stories d1000000-…
-- ════════════════════════════════════════════════════════════════════

begin;

-- ───────── 0. remove the previous seed ─────────
delete from public.donations d
where d.user_id::text like 'a1000000-%'
   or d.issue_id in (select id from public.issues where id::text like 'b1000000-%' or author_id::text like 'a1000000-%');
delete from public.issues where id::text like 'b1000000-%';
delete from auth.users where id::text like 'a1000000-%';   -- cascades to identities, profiles and their rows

-- Seed writes timestamps, statuses and timelines directly, so pause the triggers that would
-- overwrite them. Counter triggers stay on: votes / comments / donations keep issue totals honest.
alter table public.profiles disable trigger profiles_guard;
alter table public.issues   disable trigger issues_bi;
alter table public.issues   disable trigger issues_ai;
alter table public.issues   disable trigger issues_touch;
alter table public.comments disable trigger comments_notify;

-- Public URL prefix of the seed photos. Change the project ref if you seed a different project.
create temp table seed_photo on commit drop as
select 'https://vzhibiqzdyjoxmrlawwa.supabase.co/storage/v1/object/public/issue-media/a1000000-0000-4000-8000-000000000006/seed/'::text as base;

-- ───────── 1. people ─────────
create temp table seed_user (
  id uuid primary key, email text, name text, handle text, role public.role_t,
  district text, company text, hue int, verified boolean, days int
) on commit drop;

insert into seed_user values
  ('a1000000-0000-4000-8000-000000000001', 'lina@matab.test',     'Lina Haddad',   'lina.h',         'citizen',    'Jabal Al-Weibdeh', null,                 18,  false, 140),
  ('a1000000-0000-4000-8000-000000000002', 'omar@matab.test',     'Omar Khalil',   'omar.k',         'citizen',    'Shmeisani',        null,                 200, false, 90),
  ('a1000000-0000-4000-8000-000000000003', 'rana@matab.test',     'Rana Saleh',    'rana.s',         'citizen',    'Khalda',           null,                 320, false, 60),
  ('a1000000-0000-4000-8000-000000000004', 'yazan@matab.test',    'Yazan Masri',   'yazan',          'citizen',    'Jubeiha',          null,                 140, false, 33),
  ('a1000000-0000-4000-8000-000000000005', 'noor@matab.test',     'Noor Abbadi',   'noor.a',         'citizen',    'Downtown',         null,                 45,  false, 12),
  ('a1000000-0000-4000-8000-000000000006', 'desk@matab.test',     'Hala Qasem',    'city.desk',      'admin',      'Municipal Ops',    null,                 230, true,  400),
  ('a1000000-0000-4000-8000-000000000007', 'nabulsi@matab.test',  'Karim Nabulsi', 'nabulsi.paving', 'contractor', 'Marka',            'Nabulsi Paving Co.', 28,  true,  300),
  ('a1000000-0000-4000-8000-000000000008', 'sahel@matab.test',    'Dina Sahel',    'sahel.electric', 'contractor', 'Sweifieh',         'Sahel Electric',     260, true,  210),
  ('a1000000-0000-4000-8000-000000000009', 'quickfix@matab.test', 'Fadi Odat',     'quickfix',       'contractor', 'Tla’ Al-Ali',      'QuickFix Handyman',  90,  false, 20);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('MatabDemo#2026', extensions.gen_salt('bf')), now() - u.days * interval '1 day',
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('name', u.name, 'handle', u.handle, 'district', u.district, 'company', u.company,
                     'account_type', case when u.role = 'contractor' then 'contractor' else 'citizen' end),
  now() - u.days * interval '1 day', now(),
  '', '', '', ''
from seed_user u;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       null, now() - u.days * interval '1 day', now()
from seed_user u;

-- handle_new_user() already created the profiles; set the fields sign-up can't (role, verified, …).
update public.profiles p set
  name = u.name, handle = u.handle, role = u.role, district = u.district, company = u.company,
  hue = u.hue, verified = u.verified, joined_at = now() - u.days * interval '1 day'
from seed_user u
where p.id = u.id;

-- ───────── 2. reports ─────────
create temp table seed_issue (
  id uuid primary key, n int, author uuid, hours numeric, status public.issue_status_t,
  title text, description text, category public.category_t, severity int,
  lat double precision, lng double precision, address text, district text, photo text,
  cost numeric, raised numeric, verified_by text, rejection_reason text,
  ai_verdict text, ai_conf numeric, ai_summary text, cost_lo int, cost_hi int, ai_reasons text[],
  ups int, downs int
) on commit drop;

insert into seed_issue values
  ('b1000000-0000-4000-8000-000000000001', 1, 'a1000000-0000-4000-8000-000000000001', 30, 'open_for_funding',
   'Deep pothole swallowing tyres on Rainbow Street',
   'Right after the First Circle turn there is a pothole about 40cm wide and deep enough that cars swerve into the opposite lane to avoid it. Two taxis lost hubcaps this morning. It fills with water when it rains so you cannot see it at night.',
   'roads', 4, 31.9512, 35.9225, 'Rainbow St, near First Circle', 'Jabal Amman', 'rainbow-pothole', 650, 412, 'ai', null,
   'accept', 0.94, 'A deep pothole on a busy lane is forcing cars into oncoming traffic.', 300, 800, null, 4, 0),

  ('b1000000-0000-4000-8000-000000000002', 2, 'a1000000-0000-4000-8000-000000000005', 96, 'assigned',
   'Every lamp on the Kalha stairs is out',
   'The public stairs from Weibdeh down to downtown have had no working lights for two weeks. Students use them after evening classes and it is pitch black halfway down.',
   'lighting', 4, 31.9568, 35.9262, 'Kalha Stairs', 'Jabal Al-Weibdeh', 'kalha-stairs-lights', 900, 900, 'ai', null,
   'accept', 0.92, 'Public stairway lighting has failed along its whole length.', 500, 1200, null, 6, 0),

  ('b1000000-0000-4000-8000-000000000003', 3, 'a1000000-0000-4000-8000-000000000002', 52, 'in_progress',
   'Burst main flooding the sidewalk on Abdul Hamid Sharaf',
   'Clean water has been gushing from a crack in the pavement since last night. The sidewalk is a river and the water is wasting while half the city waits for its water day.',
   'water', 5, 31.9702, 35.8996, 'Abdul Hamid Sharaf St', 'Shmeisani', 'burst-main', 1800, 1800, 'ai', null,
   'accept', 0.97, 'A broken water main is flooding a pedestrian sidewalk.', 900, 2500, null, 8, 0),

  ('b1000000-0000-4000-8000-000000000004', 4, 'a1000000-0000-4000-8000-000000000003', 20, 'open_for_funding',
   'Lifted sidewalk slabs outside a primary school',
   'Tree roots have pushed up six slabs on the school side of the road. Kids trip every morning and parents walk in the street instead. Photo taken at drop-off.',
   'sidewalks', 4, 31.9901, 35.8652, 'Wasfi Al-Tal St, school gate', 'Tla’ Al-Ali', 'school-sidewalk', 2400, 760, 'ai', null,
   'accept', 0.91, 'Raised slabs at a school entrance are a trip hazard for children.', 1500, 3200, null, 3, 0),

  ('b1000000-0000-4000-8000-000000000005', 5, 'a1000000-0000-4000-8000-000000000003', 384, 'resolved',
   'Stop sign knocked flat at a blind junction',
   'Someone hit the stop sign at the Khalda junction and it is lying in the bushes. Drivers coming downhill do not stop anymore.',
   'signage', 5, 31.9928, 35.8451, 'Al-Ameer Hashem St junction', 'Khalda', 'stop-sign', 320, 320, 'ai', null,
   'accept', 0.95, 'A missing stop sign at a blind junction is a serious collision risk.', 150, 450, null, 4, 0),

  ('b1000000-0000-4000-8000-000000000006', 6, 'a1000000-0000-4000-8000-000000000005', 5, 'pending_review',
   'Storm drain packed with rubble near the Roman Theatre',
   'The drain grate on the corner by the theatre steps is completely filled with rubble and plastic. Last rain the whole corner flooded and shops had water inside.',
   'drainage', 3, 31.9515, 35.9395, 'Hashemite Plaza corner', 'Downtown', 'roman-theatre-drain', null, 0, 'ai', null,
   'accept', 0.88, 'A blocked storm drain is causing street flooding next to shops.', 250, 900, null, 1, 0),

  ('b1000000-0000-4000-8000-000000000007', 7, 'a1000000-0000-4000-8000-000000000004', 70, 'open_for_funding',
   'Snapped swing chain at Jubeiha neighbourhood park',
   'One of the two swings has a snapped chain hanging at head height. The other one is rusty. This is the only playground within walking distance.',
   'parks', 2, 32.0231, 35.8742, 'Jubeiha Park, north gate', 'Jubeiha', 'jubeiha-swing', 380, 95, 'ai', null,
   'accept', 0.86, 'A broken swing chain in a public playground is a minor injury risk.', 200, 600, null, 2, 0),

  ('b1000000-0000-4000-8000-000000000008', 8, 'a1000000-0000-4000-8000-000000000002', 648, 'resolved',
   'Open manhole with no cover on a Marka side street',
   'The manhole cover is gone completely. Someone put a plastic chair in it as a warning. A kid could fall in.',
   'drainage', 5, 31.9751, 35.9852, 'Side street off Army St', 'Marka', 'marka-manhole', 260, 260, 'ai', null,
   'accept', 0.96, 'An uncovered manhole on a residential street is a fall hazard.', 150, 400, null, 7, 0),

  ('b1000000-0000-4000-8000-000000000009', 9, 'a1000000-0000-4000-8000-000000000001', 3, 'pending_review',
   'Crumbling public steps behind Paris Square',
   'steps broken, need fix',
   'sidewalks', 3, 31.9585, 35.9208, 'Behind Paris Square', 'Jabal Al-Weibdeh', 'paris-square-steps', null, 0, null, null,
   'review', 0.62, 'Public steps appear damaged.', 400, 2000,
   array['Description is very short.', 'Photo is dark; extent of damage unclear.'], 0, 0),

  ('b1000000-0000-4000-8000-000000000010', 10, 'a1000000-0000-4000-8000-000000000004', 120, 'open_for_funding',
   'Street lamp flickering like a strobe all night',
   'The lamp outside building 14 flickers on and off every second from sunset to sunrise. It is giving residents headaches and the corner is basically dark.',
   'lighting', 2, 31.9432, 35.8801, 'Abdoun Circle, bldg 14', 'Abdoun', 'abdoun-lamp', 220, 180, 'ai', null,
   'accept', 0.83, 'A faulty street lamp is flickering through the night.', 120, 400, null, 1, 1),

  ('b1000000-0000-4000-8000-000000000011', 11, 'a1000000-0000-4000-8000-000000000004', 9, 'pending_review',
   'Cluster of potholes on the Abu Nseir bus route',
   'Five or six potholes in a row along the bus lane by the roundabout. Buses slam through them and the shaking is cracking the curb as well.',
   'roads', 3, 32.0572, 35.8831, 'Abu Nseir roundabout', 'Abu Nseir', 'abu-nseir-potholes', null, 0, 'ai', null,
   'accept', 0.87, 'Several potholes along a bus lane are damaging the road edge.', 800, 3000, null, 1, 0),

  ('b1000000-0000-4000-8000-000000000012', 12, 'a1000000-0000-4000-8000-000000000001', 960, 'resolved',
   'Fire hydrant leaking day and night in Sweifieh',
   'The hydrant on the corner has a constant leak from the side valve. There is a permanent puddle and green algae on the pavement.',
   'water', 3, 31.9561, 35.8622, 'Wakalat St corner', 'Sweifieh', 'sweifieh-hydrant', 450, 450, 'ai', null,
   'accept', 0.90, 'A leaking hydrant valve is wasting water continuously.', 250, 700, null, 2, 0),

  ('b1000000-0000-4000-8000-000000000013', 13, 'a1000000-0000-4000-8000-000000000005', 14, 'rejected',
   'Cheap tyres 50% off this week only',
   'Buy now cheap tyres 50% discount call us, follow me for promo',
   'other', 1, 31.96, 35.91, '—', 'Unknown district', 'spam-tyres', null, 0, null, 'Advertisement — not an infrastructure report.',
   'reject', 0.97, 'Promotional text.', 0, 0,
   array['Text is an advertisement.', 'Photo does not show public damage.'], 0, 3);

-- When each report reached each stage (hours ago). Bids, donations and the timeline hang off this.
create temp table seed_timeline (
  issue uuid primary key, open_h numeric, assigned_h numeric, work_h numeric, fixed_h numeric
) on commit drop;

insert into seed_timeline values
  ('b1000000-0000-4000-8000-000000000001', 18,  null, null, null),  -- Rainbow St pothole
  ('b1000000-0000-4000-8000-000000000002', 72,  46,   null, null),  -- Kalha stairs lights
  ('b1000000-0000-4000-8000-000000000003', 44,  30,   18,   null),  -- burst main
  ('b1000000-0000-4000-8000-000000000004', 12,  null, null, null),  -- school sidewalk
  ('b1000000-0000-4000-8000-000000000005', 360, 300,  200,  168),   -- stop sign
  ('b1000000-0000-4000-8000-000000000007', 48,  null, null, null),  -- swing
  ('b1000000-0000-4000-8000-000000000008', 636, 620,  600,  576),   -- manhole
  ('b1000000-0000-4000-8000-000000000010', 100, null, null, null),  -- flickering lamp
  ('b1000000-0000-4000-8000-000000000012', 920, 880,  850,  816);   -- hydrant

-- Oldest first, so ticket refs (MT-0100, …) follow the order reports came in.
insert into public.issues (
  id, author_id, title, description, category, severity, status, lat, lng, accuracy, address, district,
  photos, estimated_cost, ai, cost_check, verified_by, rejection_reason, created_at, updated_at
)
select
  s.id, s.author, s.title, s.description, s.category, s.severity, s.status, s.lat, s.lng, 6 + s.n % 9,
  s.address, s.district, array[(select base from seed_photo) || s.photo], s.cost,
  jsonb_build_object(
    'verdict', s.ai_verdict, 'confidence', s.ai_conf, 'category', s.category, 'severity', s.severity,
    'title', s.title, 'summary', s.ai_summary, 'costRange', jsonb_build_array(s.cost_lo, s.cost_hi),
    'reasons', to_jsonb(coalesce(s.ai_reasons, array['Clear photo of damage to a public asset.', 'Location is a public right-of-way.'])),
    'model', 'google/gemma-4-26b-a4b-it', 'source', 'gemma',
    'at', to_jsonb(now() - (s.hours - 0.01) * interval '1 hour')),
  case when s.cost is not null then jsonb_build_object(
    'verdict', 'accept', 'confidence', 0.88,
    'reasons', jsonb_build_array('Estimate sits within the expected range for this repair.'),
    'model', 'google/gemma-4-26b-a4b-it', 'source', 'gemma',
    'at', to_jsonb(now() - (t.open_h + 0.1) * interval '1 hour')) end,
  s.verified_by, s.rejection_reason,
  now() - s.hours * interval '1 hour',
  now() - coalesce(t.fixed_h, t.work_h, t.assigned_h, t.open_h, s.hours) * interval '1 hour'
from seed_issue s
left join seed_timeline t on t.issue = s.id
order by s.hours desc;

-- ───────── 3. contractor bids ─────────
create temp table seed_bid (
  id uuid primary key, issue uuid, contractor uuid, amount numeric, days int, message text,
  status public.bid_status_t, hours numeric, score int, verdict text, reasons text[]
) on commit drop;

insert into seed_bid values
  ('c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000007', 610, 2,
   'Saw-cut the failed area 1.2×1.2m, compact new base course, hot-mix asphalt patch and seal edges. Night work 11pm–5am with cones and a flagman, street reopened by morning.',
   'pending', 10, 84, 'accept', array['Price 6% under estimate.', 'Clear method statement with traffic management.', 'Two jobs completed on Matab.']),
  ('c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000009', 980, 1,
   'We fix fast. Cold patch same day.',
   'pending', 6, 41, 'review', array['Price 51% above estimate.', 'Cold patch is a temporary fix on a busy road.', 'Contractor not yet verified.']),
  ('c1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000008', 870, 5,
   'Replace 11 failed LED fixtures and the corroded junction box at the top landing; test circuit and add a photocell timer.',
   'approved', 60, 88, 'accept', array['In line with estimate.', 'Electrical specialist, verified.']),
  ('c1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000007', 1750, 3,
   'Emergency excavation, replace 2m of main with ductile iron, backfill and reinstate the sidewalk with matching tiles.',
   'approved', 40, 86, 'accept', array['Slightly under estimate.', 'Realistic timeline for severity 5.']),
  ('c1000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000007', 2300, 6,
   'Lift and relay 14m² of slabs, install a root barrier along the tree line, new kerb section at the gate. Work during weekend to avoid school hours.',
   'pending', 8, 81, 'accept', array['Price 4% under estimate.', 'Schedules around school hours.']),
  ('c1000000-0000-4000-8000-000000000006', 'b1000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000009', 350, 2,
   'Replace both swing chains and seats with galvanised chain, sand and repaint frame.',
   'pending', 30, 63, 'review', array['Price fits estimate.', 'Contractor not yet verified.']),
  ('c1000000-0000-4000-8000-000000000007', 'b1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000008', 300, 1,
   'Reinstall sign on a new break-away post, add reflective sheeting.',
   'approved', 330, 80, 'accept', array['Within estimate.']),
  ('c1000000-0000-4000-8000-000000000008', 'b1000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000007', 250, 1,
   'Supply and fit ductile-iron cover and frame, re-bed with rapid-set mortar.',
   'approved', 630, 90, 'accept', array['Within estimate.', 'Urgent safety job, 1-day turnaround.']);

insert into public.bids (id, issue_id, contractor_id, amount, days, message, status, ai, decided_at, decision_note, "authorization", created_at)
select
  b.id, b.issue, b.contractor, b.amount, b.days, b.message, b.status,
  jsonb_build_object('verdict', b.verdict, 'confidence', 0.8, 'score', b.score, 'reasons', to_jsonb(b.reasons),
                     'model', 'google/gemma-4-26b-a4b-it', 'source', 'gemma', 'at', to_jsonb(now() - b.hours * interval '1 hour')),
  case when b.status = 'approved' then now() - t.assigned_h * interval '1 hour' end,
  case when b.status = 'approved' then 'Best value, verified crew, fits the work window.' end,
  case when b.status = 'approved' then 'WA-' || lpad(i.ref::text, 4, '0') || '-' || upper(substr(md5(b.id::text), 1, 4)) end,
  now() - b.hours * interval '1 hour'
from seed_bid b
join public.issues i on i.id = b.issue
left join seed_timeline t on t.issue = b.issue;

update public.issues i set assigned_bid_id = b.id
from seed_bid b
where b.issue = i.id and b.status = 'approved';

-- ───────── 4. success stories ─────────
insert into public.stories (id, issue_id, after_photos, summary, final_cost, days_to_fix, contractor_id, created_at) values
  ('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000005', array[(select base from seed_photo) || 'stop-sign-fixed'],
   'New reflective stop sign on a break-away post, plus a rumble strip on the downhill approach. Reported, funded and fixed in 9 days.',
   300, 9, 'a1000000-0000-4000-8000-000000000008', now() - interval '7 days'),
  ('d1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000008', array[(select base from seed_photo) || 'marka-manhole-fixed'],
   'Ductile-iron cover fitted and locked. The plastic chair has been retired with honours.',
   250, 3, 'a1000000-0000-4000-8000-000000000007', now() - interval '24 days'),
  ('d1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000012', array[(select base from seed_photo) || 'sweifieh-hydrant-fixed'],
   'Valve gasket replaced by the municipal water crew; the algae patch was pressure-washed.',
   410, 6, null, now() - interval '34 days');

update public.issues i set story_id = s.id
from public.stories s
where s.issue_id = i.id and s.id::text like 'd1000000-%';

-- ───────── 5. public timeline ─────────
-- Intake + Gemma screening for every report…
insert into public.status_events (issue_id, status, note, actor_id, at)
select s.id, 'pending_review', 'Report received.', s.author, now() - s.hours * interval '1 hour'
from seed_issue s;

insert into public.status_events (issue_id, status, note, actor_id, at)
select s.id,
  case when s.status = 'rejected' then 'rejected'::public.issue_status_t else 'pending_review' end,
  case
    when s.status = 'rejected' then 'Screened out by Gemma. The author can appeal.'
    when s.verified_by = 'ai' then 'Auto-verified by Gemma (' || round(s.ai_conf * 100) || '% confidence). Waiting for a cost estimate.'
    else 'Gemma was unsure — queued for a human reviewer.'
  end,
  null, now() - (s.hours - 0.02) * interval '1 hour'
from seed_issue s;

-- …then one entry per lifecycle step the report has reached, posted by the municipal desk.
insert into public.status_events (issue_id, status, note, actor_id, at)
select t.issue, step.status,
  case step.status
    when 'open_for_funding' then 'Cost estimate published. Fundraising open.'
    when 'assigned' then coalesce('Work authorised for ' || rtrim(p.company, '.') || '.', 'Assigned to the municipal works crew.')
    when 'in_progress' then 'Crew on site.'
    when 'resolved' then 'Repair verified. Success story published.'
  end,
  'a1000000-0000-4000-8000-000000000006',
  now() - step.h * interval '1 hour'
from seed_timeline t
cross join lateral (values
  ('open_for_funding'::public.issue_status_t, t.open_h),
  ('assigned', t.assigned_h),
  ('in_progress', t.work_h),
  ('resolved', t.fixed_h)
) as step(status, h)
join public.issues i on i.id = t.issue
left join public.bids b on b.id = i.assigned_bid_id
left join public.profiles p on p.id = b.contractor_id
where step.h is not null;

-- ───────── 6. votes ─────────
-- Every author backs their own report; then `ups` / `downs` other accounts vote, picked deterministically.
insert into public.votes (issue_id, user_id, value)
select s.id, s.author, 1 from seed_issue s where s.status <> 'rejected';

insert into public.votes (issue_id, user_id, value)
select v.issue, v.voter, case when v.rk <= v.ups then 1 else -1 end
from (
  select s.id as issue, u.id as voter, s.ups, s.downs,
         row_number() over (partition by s.id order by md5(s.id::text || u.id::text)) as rk
  from seed_issue s
  join seed_user u on u.id <> s.author
) v
where v.rk <= v.ups + v.downs;

-- ───────── 7. comments ─────────
insert into public.comments (issue_id, author_id, body, created_at)
select c.issue, c.author, c.body, now() - c.h * interval '1 hour'
from (values
  (27::numeric, 'b1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-000000000002'::uuid, 'Drove through this at night by accident. Bent my rim. Upvoted.'),
  (24,          'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004', 'There is a second smaller one ten metres further up too.'),
  (17,          'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000006', 'Verified by our roads team on site. Official estimate attached — 650 JOD covers cut, base layer and hot-mix patch.'),
  (9.5,         'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000007', 'We can do this in a single night shift to avoid blocking the street.'),
  (47,          'b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Thank you to everyone who chipped in — fully funded in under 3 days!'),
  (45.5,        'b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000006', 'Sahel Electric has been authorised. Work window: next Sunday–Thursday after 6pm.'),
  (50,          'b1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', 'Water company truck just arrived 🙏'),
  (17,          'b1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000007', 'Crew on site. Main is isolated; excavation started, sidewalk reinstatement tomorrow.'),
  (10,          'b1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000005', 'My nephew goes to this school. Donated 20.'),
  (11.5,        'b1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000006', 'Estimate includes root barrier so this does not happen again.'),
  (40,          'b1000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000001', 'Taking my kids here on weekends, happy to help.'),
  (3,           'b1000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000002', 'Shops on that corner lost stock last winter because of this.'),
  (167,         'b1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000006', 'Replaced with a reflective sign and a new rumble strip. Thanks Rana for reporting.')
) as c(h, issue, author, body);

-- ───────── 8. donations ─────────
-- Split each report's `raised` total into small gifts from the five citizens, made between the
-- campaign opening and the job being awarded (or now, for campaigns still open).
do $$
declare
  r record;
  pattern int[] := array[10, 25, 50, 15, 100, 5, 40, 20];
  donors uuid[] := array[
    'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000005']::uuid[];
  chunks numeric[];
  remaining numeric;
  piece numeric;
  mult int;
  k int;
begin
  for r in
    select s.id, s.n, s.raised, t.open_h, coalesce(t.assigned_h, 0.5) as close_h
    from seed_issue s join seed_timeline t on t.issue = s.id
    where s.raised > 0
  loop
    chunks := '{}';
    remaining := r.raised;
    mult := greatest(1, floor(r.raised / 250)::int);
    k := 0;
    while remaining > 0 loop
      piece := least(remaining, pattern[k % 8 + 1] * mult);
      chunks := chunks || piece;
      remaining := remaining - piece;
      k := k + 1;
    end loop;
    for k in 1 .. array_length(chunks, 1) loop
      insert into public.donations (issue_id, user_id, amount, anonymous, method, reference, created_at)
      values (
        r.id, donors[(k + r.n) % 5 + 1], chunks[k], k % 5 = 4, 'card',
        'TX-' || upper(substr(md5(r.id::text || k::text), 1, 10)),
        now() - (r.open_h - (r.open_h - r.close_h) * k::numeric / (array_length(chunks, 1) + 1)) * interval '1 hour'
      );
    end loop;
  end loop;
end $$;

-- ───────── 9. notifications ─────────
insert into public.notifications (user_id, kind, title, body, link, read, at)
select n.user_id, n.kind, n.title, n.body, n.link, n.read, now() - n.hours * interval '1 hour'
from (
  select 'a1000000-0000-4000-8000-000000000001'::uuid as user_id, 'status' as kind,
         'Your report is open for funding' as title,
         public.ticket(i.ref) || ' · Deep pothole on Rainbow Street — official estimate JOD 650.' as body,
         '/issue/' || i.id as link, false as read, 18::numeric as hours
  from public.issues i where i.id = 'b1000000-0000-4000-8000-000000000001'
  union all
  select 'a1000000-0000-4000-8000-000000000001', 'comment', 'Hala Qasem commented on ' || public.ticket(i.ref),
         'Verified by our roads team on site…', '/issue/' || i.id, false, 17
  from public.issues i where i.id = 'b1000000-0000-4000-8000-000000000001'
  union all
  select 'a1000000-0000-4000-8000-000000000001', 'story', 'Fixed: ' || i.title,
         'Your report became a success story.', '/stories/d1000000-0000-4000-8000-000000000003', true, 816
  from public.issues i where i.id = 'b1000000-0000-4000-8000-000000000012'
  union all
  select 'a1000000-0000-4000-8000-000000000007', 'bid_approved', 'Work authorised · ' || public.ticket(i.ref),
         'Authorisation ' || b."authorization" || '. You may begin physical work.', '/contractor?tab=orders', false, 30
  from public.issues i join public.bids b on b.id = i.assigned_bid_id
  where i.id = 'b1000000-0000-4000-8000-000000000003'
  union all
  select 'a1000000-0000-4000-8000-000000000008', 'bid_approved', 'Work authorised · ' || public.ticket(i.ref),
         'Authorisation ' || b."authorization" || '. You may begin physical work.', '/contractor?tab=orders', false, 46
  from public.issues i join public.bids b on b.id = i.assigned_bid_id
  where i.id = 'b1000000-0000-4000-8000-000000000002'
  union all
  select 'a1000000-0000-4000-8000-000000000006', 'status', '3 reports waiting for triage',
         'Gemma auto-verified 2, flagged 1 for review.', '/admin', false, 2
) n;

-- ───────── 10. finish ─────────
select public.refresh_issue_counters(id) from public.issues where id::text like 'b1000000-%';

alter table public.profiles enable trigger profiles_guard;
alter table public.issues   enable trigger issues_bi;
alter table public.issues   enable trigger issues_ai;
alter table public.issues   enable trigger issues_touch;
alter table public.comments enable trigger comments_notify;

commit;
