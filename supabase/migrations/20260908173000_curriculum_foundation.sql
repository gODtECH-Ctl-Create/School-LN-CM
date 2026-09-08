-- School LN CM: curriculum foundation
-- Curriculum is scoped to a school, academic session, term, class and subject.

create type public.curriculum_status as enum (
  'draft',
  'published',
  'archived'
);

create table public.curricula (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_session_id uuid not null references public.academic_sessions(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  description text,
  status public.curriculum_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, academic_session_id, term_id, class_id, subject_id),
  constraint curricula_title_valid check (length(trim(title)) between 2 and 160)
);

create table public.curriculum_units (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  unit_number integer not null check (unit_number > 0),
  title text not null,
  summary text,
  sort_order integer not null default 1 check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_id, unit_number)
);

create table public.curriculum_topics (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.curriculum_units(id) on delete cascade,
  title text not null,
  summary text,
  week_number integer check (week_number is null or week_number between 1 and 52),
  lesson_count integer not null default 1 check (lesson_count > 0),
  sort_order integer not null default 1 check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index curricula_school_id_idx on public.curricula(school_id);
create index curricula_context_idx on public.curricula(academic_session_id, term_id, class_id, subject_id);
create index curriculum_units_curriculum_id_idx on public.curriculum_units(curriculum_id);
create index curriculum_topics_unit_id_idx on public.curriculum_topics(unit_id);

alter table public.curricula enable row level security;
alter table public.curriculum_units enable row level security;
alter table public.curriculum_topics enable row level security;

create policy "members can view curricula"
  on public.curricula for select
  using (public.is_school_member(school_id));

create policy "teachers can view assigned curricula"
  on public.curricula for select
  using (
    exists (
      select 1
      from public.school_memberships sm
      join public.academic_sessions s on s.id = academic_session_id
      join public.teacher_assignments ta on ta.membership_id = sm.id
        and ta.class_id = curricula.class_id
        and ta.subject_id = curricula.subject_id
        and ta.academic_session_id = curricula.academic_session_id
      where sm.user_id = auth.uid()
        and sm.is_active = true
        and sm.school_id = curricula.school_id
        and sm.role = 'teacher'
        and s.school_id = curricula.school_id
    )
  );

create policy "academic admins manage curricula"
  on public.curricula for all
  using (public.has_school_role(school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[]))
  with check (public.has_school_role(school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[]));

create policy "members can view curriculum units"
  on public.curriculum_units for select
  using (
    exists (
      select 1 from public.curricula c
      where c.id = curriculum_id and public.is_school_member(c.school_id)
    )
  );

create policy "academic admins manage curriculum units"
  on public.curriculum_units for all
  using (
    exists (
      select 1 from public.curricula c
      where c.id = curriculum_id
        and public.has_school_role(c.school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[])
    )
  )
  with check (
    exists (
      select 1 from public.curricula c
      where c.id = curriculum_id
        and public.has_school_role(c.school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[])
    )
  );

create policy "members can view curriculum topics"
  on public.curriculum_topics for select
  using (
    exists (
      select 1
      from public.curriculum_units u
      join public.curricula c on c.id = u.curriculum_id
      where u.id = unit_id and public.is_school_member(c.school_id)
    )
  );

create policy "academic admins manage curriculum topics"
  on public.curriculum_topics for all
  using (
    exists (
      select 1
      from public.curriculum_units u
      join public.curricula c on c.id = u.curriculum_id
      where u.id = unit_id
        and public.has_school_role(c.school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[])
    )
  )
  with check (
    exists (
      select 1
      from public.curriculum_units u
      join public.curricula c on c.id = u.curriculum_id
      where u.id = unit_id
        and public.has_school_role(c.school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[])
    )
  );

revoke all on public.curricula from anon;
revoke all on public.curriculum_units from anon;
revoke all on public.curriculum_topics from anon;
