-- ════════════════════════════════════════════════════════════════════
-- 0004 · let Gemma award a bid without the municipal desk
-- ════════════════════════════════════════════════════════════════════
-- Called only by the ai-screen edge function (service role) when Gemma accepts a verified
-- contractor's bid with ≥ 70% confidence. Same effect as an admin approving it in decide_bid():
-- authorisation code, issue → assigned, other pending bids declined, everyone notified.

create or replace function public.auto_award_bid(p_bid uuid, p_note text default '')
returns public.bids language plpgsql security definer set search_path = public as $$
declare b public.bids; i public.issues; o record; comp text;
begin
  select * into b from public.bids where id = p_bid for update;
  if b.id is null then raise exception 'Bid not found'; end if;
  if b.status <> 'pending' then raise exception 'Bid already decided'; end if;
  select * into i from public.issues where id = b.issue_id for update;
  if i.assigned_bid_id is not null then raise exception 'Issue already awarded'; end if;

  update public.bids set status = 'approved', decided_at = now(), decision_note = nullif(p_note, ''),
    "authorization" = 'WA-' || lpad(i.ref::text, 4, '0') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4))
  where id = p_bid returning * into b;
  select coalesce(company, name) into comp from public.profiles where id = b.contractor_id;
  update public.issues set assigned_bid_id = b.id, status = 'assigned' where id = i.id;
  insert into public.status_events (issue_id, status, note, actor_id)
    values (i.id, 'assigned', 'Work authorised for ' || comp || ' — approved automatically by Gemma.', null);
  perform public.notify(b.contractor_id, 'bid_approved', 'Work authorised · ' || public.ticket(i.ref),
    'Authorisation ' || b."authorization" || '. You may begin physical work.', '/contractor?tab=orders');
  perform public.notify(i.author_id, 'status', public.ticket(i.ref) || ' has a contractor', comp || ' will carry out the repair.', '/issue/' || i.id);
  for o in select * from public.bids where issue_id = i.id and id <> b.id and status = 'pending' loop
    update public.bids set status = 'rejected', decided_at = now(), decision_note = 'Another bid was selected.' where id = o.id;
    perform public.notify(o.contractor_id, 'bid_rejected', 'Bid not selected · ' || public.ticket(i.ref), 'Another contractor was awarded this job.', '/contractor');
  end loop;
  return b;
end $$;

-- Service role only — signed-in users must not be able to award themselves work.
revoke execute on function public.auto_award_bid(uuid, text) from public, anon, authenticated;
