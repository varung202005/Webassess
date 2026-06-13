-- Student portal schema additions.
-- Safe to run repeatedly in the Supabase SQL editor.

create table if not exists public.students (
  user_id uuid primary key references public.users(id) on delete cascade,
  roll_number text unique,
  department_id uuid references public.departments(id) on delete set null,
  semester integer check (semester between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exam_schedules
  add column if not exists registration_deadline timestamptz;

alter table public.exams
  add column if not exists semester integer check (semester between 1 and 12);

alter table public.results
  add column if not exists faculty_remarks text;

alter table public.student_answers
  add column if not exists selected_option_ids uuid[];

create unique index if not exists re_evaluation_requests_one_per_result
  on public.re_evaluation_requests(result_id, student_id);

create index if not exists students_department_idx
  on public.students(department_id);

create index if not exists exam_schedules_registration_deadline_idx
  on public.exam_schedules(registration_deadline);

alter table public.students enable row level security;

drop policy if exists "Students can read own academic profile" on public.students;
create policy "Students can read own academic profile"
  on public.students for select
  using (auth.uid() = user_id);

drop policy if exists "Students can update own academic profile" on public.students;
create policy "Students can update own academic profile"
  on public.students for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
