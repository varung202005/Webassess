-- Candidate portal support for entrance exams.
-- Candidates are role-based: any user with the Candidate role can access
-- published ENTRANCE exams during their scheduled window.

insert into public.roles (name)
select 'Candidate'
where not exists (
  select 1 from public.roles where lower(name) = lower('Candidate')
);
