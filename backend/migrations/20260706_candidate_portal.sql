-- Candidate portal support for entrance exams.
-- Candidates receive faculty-issued login credentials and can access only the
-- entrance exam schedules assigned to them.

insert into public.roles (name)
select 'Candidate'
where not exists (
  select 1 from public.roles where lower(name) = lower('Candidate')
);

create extension if not exists pgcrypto;

create table if not exists public.candidate_exam_assignments (
  id uuid primary key default gen_random_uuid(),
  exam_schedule_id uuid not null references public.exam_schedules(id) on delete cascade,
  candidate_id uuid not null references public.users(id) on delete cascade,
  invited_by uuid references public.users(id) on delete set null,
  status text not null default 'INVITED'
    check (status in ('INVITED', 'STARTED', 'COMPLETED', 'EXPIRED')),
  invitation_token text not null default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_schedule_id, candidate_id),
  unique (invitation_token)
);

create index if not exists idx_candidate_assignments_schedule
  on public.candidate_exam_assignments(exam_schedule_id);

create index if not exists idx_candidate_assignments_candidate
  on public.candidate_exam_assignments(candidate_id);
