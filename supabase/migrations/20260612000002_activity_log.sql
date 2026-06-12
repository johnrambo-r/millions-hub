create table if not exists activity_log (
  id uuid default gen_random_uuid() primary key,
  candidate_id text,
  mandate_id text,
  applicant_id text,
  changed_by uuid references auth.users(id),
  change_type text,
  old_value text,
  new_value text,
  created_at timestamptz default now()
);

alter table public.activity_log enable row level security;

create policy "Authenticated users can insert activity_log"
on public.activity_log for insert to authenticated
with check (changed_by = auth.uid());

create policy "Authenticated users can view activity_log"
on public.activity_log for select to authenticated
using (true);
