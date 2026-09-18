-- School LN CM: simple people model
-- The product exposes two primary user experiences: Admin and Teacher.
-- Head Teacher is an access level on a teacher, not a separate product role.

alter table public.school_memberships
  add column if not exists is_head_teacher boolean not null default false;

alter table public.school_memberships
  drop constraint if exists school_memberships_head_teacher_role_check;

alter table public.school_memberships
  add constraint school_memberships_head_teacher_role_check
  check (role = 'teacher' or is_head_teacher = false);

create index if not exists school_memberships_head_teacher_idx
  on public.school_memberships(school_id, is_head_teacher)
  where role = 'teacher' and is_active = true;
