-- School LN CM: lesson-note foundation
-- A lesson note belongs to a teacher and preserves the curriculum context used to prepare it.

create type public.lesson_note_status as enum (
  'draft',
  'published',
  'archived'
);

create table public.lesson_notes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_membership_id uuid not null references public.school_memberships(id) on delete cascade,
  curriculum_id uuid references public.curricula(id) on delete set null,
  curriculum_unit_id uuid references public.curriculum_units(id) on delete set null,
  curriculum_topic_id uuid references public.curriculum_topics(id) on delete set null,
  academic_session_id uuid not null references public.academic_sessions(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  title text not null,
  duration_minutes integer not null default 40 check (duration_minutes between 5 and 240),
  learning_objectives text,
  lesson_introduction text,
  lesson_content text,
  teacher_activities text,
  learner_activities text,
  assessment text,
  homework text,
  materials text,
  status public.lesson_note_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_membership_id, academic_session_id, term_id, class_id, subject_id, title)
);

create index lesson_notes_school_id_idx on public.lesson_notes(school_id);
create index lesson_notes_teacher_membership_idx on public.lesson_notes(teacher_membership_id);
create index lesson_notes_curriculum_topic_idx on public.lesson_notes(curriculum_topic_id);
create index lesson_notes_context_idx on public.lesson_notes(academic_session_id, term_id, class_id, subject_id);

alter table public.lesson_notes enable row level security;

create policy "teachers view their lesson notes"
  on public.lesson_notes for select
  using (
    exists (
      select 1
      from public.school_memberships sm
      where sm.id = teacher_membership_id
        and sm.user_id = auth.uid()
        and sm.school_id = lesson_notes.school_id
        and sm.is_active = true
        and sm.role = 'teacher'
    )
  );

create policy "teachers create their lesson notes"
  on public.lesson_notes for insert
  with check (
    exists (
      select 1
      from public.school_memberships sm
      join public.teacher_assignments ta on ta.membership_id = sm.id
        and ta.academic_session_id = lesson_notes.academic_session_id
        and ta.class_id = lesson_notes.class_id
        and ta.subject_id = lesson_notes.subject_id
      where sm.id = teacher_membership_id
        and sm.user_id = auth.uid()
        and sm.school_id = lesson_notes.school_id
        and sm.is_active = true
        and sm.role = 'teacher'
    )
  );

create policy "teachers update their lesson notes"
  on public.lesson_notes for update
  using (
    exists (
      select 1 from public.school_memberships sm
      where sm.id = teacher_membership_id
        and sm.user_id = auth.uid()
        and sm.school_id = lesson_notes.school_id
        and sm.is_active = true
        and sm.role = 'teacher'
    )
  )
  with check (
    exists (
      select 1 from public.school_memberships sm
      where sm.id = teacher_membership_id
        and sm.user_id = auth.uid()
        and sm.school_id = lesson_notes.school_id
        and sm.is_active = true
        and sm.role = 'teacher'
    )
  );

create policy "academic admins manage lesson notes"
  on public.lesson_notes for all
  using (public.has_school_role(school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[]))
  with check (public.has_school_role(school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[]));

revoke all on public.lesson_notes from anon;
