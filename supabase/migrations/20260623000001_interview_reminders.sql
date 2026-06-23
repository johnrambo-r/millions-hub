-- interview_reminders: stores per-candidate-mandate scheduled reminders
-- fire_time is computed live as interview_date + interview_time - lead_time_minutes,
-- so if the interview is rescheduled, the reminder automatically reflects the new time
-- without any extra logic.

create table public.interview_reminders (
  id                    uuid        primary key default gen_random_uuid(),
  mandate_candidate_id  uuid        not null references public.mandate_candidates(id) on delete cascade,
  lead_time_minutes     integer     not null,
  created_by            uuid        not null references public.profiles(id),
  fired_at              timestamptz,
  cancelled_at          timestamptz,
  created_at            timestamptz not null default now()
);

alter table public.interview_reminders enable row level security;

-- SELECT: all authenticated users can read (mirrors mandate_candidates pattern)
create policy "Authenticated users can read interview_reminders"
  on public.interview_reminders for select to authenticated
  using (true);

-- INSERT: founders and AMs can insert for any candidate
create policy "Founders and AMs can insert interview_reminders"
  on public.interview_reminders for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('founder', 'account_manager')
    )
  );

-- INSERT: recruiters can insert only for candidates they personally linked
create policy "Recruiters can insert interview_reminders for their linked candidates"
  on public.interview_reminders for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'recruiter'
    )
    and exists (
      select 1 from public.mandate_candidates
      where id = mandate_candidate_id and linked_by = auth.uid()
    )
  );

-- UPDATE: founders and AMs can update (cancel) any reminder
create policy "Founders and AMs can update interview_reminders"
  on public.interview_reminders for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('founder', 'account_manager')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('founder', 'account_manager')
    )
  );

-- UPDATE: recruiters can update (cancel) reminders they created
create policy "Recruiters can update their own interview_reminders"
  on public.interview_reminders for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
