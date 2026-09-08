-- School LN CM: multi-tenant foundation
-- Supabase / PostgreSQL

create extension if not exists pgcrypto;

create type public.user_role as enum (
  'platform_admin',
  'school_admin',
  'academic_coordinator',
  'teacher',
  'staff'
);

create type public.subscription_status as enum (
  'trial',
  'active',
  'past_due',
  'expired',
  'suspended'
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  email text,
  phone text,
  address text,
  logo_url text,
  timezone text not null default 'Africa/Lagos',
  currency text not null default 'NGN',
  subscription_status public.subscription_status not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schools_code_format check (code ~ '^[A-Z0-9]{2,12}$')
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, user_id)
);

create table public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null unique references public.school_memberships(id) on delete cascade,
  staff_code text not null,
  first_name text not null,
  last_name text not null,
  phone text,
  job_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_code)
);

create unique index staff_profiles_school_code_unique
  on public.staff_profiles ((split_part(staff_code, '-', 1)), staff_code);

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price_kobo bigint not null check (price_kobo >= 0),
  billing_period text not null default 'term',
  max_teachers integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.school_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.subscription_status not null default 'active',
  provider text,
  provider_reference text,
  created_at timestamptz not null default now(),
  constraint subscription_dates_valid check (ends_at > starts_at),
  unique (provider, provider_reference)
);

create table public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name),
  constraint academic_session_dates_valid check (ends_on >= starts_on)
);

create table public.terms (
  id uuid primary key default gen_random_uuid(),
  academic_session_id uuid not null references public.academic_sessions(id) on delete cascade,
  name text not null,
  term_number smallint not null check (term_number between 1 and 3),
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_session_id, term_number),
  constraint term_dates_valid check (ends_on >= starts_on)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name),
  unique (school_id, code)
);

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.school_memberships(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  academic_session_id uuid not null references public.academic_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (membership_id, class_id, subject_id, academic_session_id)
);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.school_memberships sm
    where sm.user_id = auth.uid()
      and sm.role = 'platform_admin'
      and sm.is_active = true
  );
$$;

create or replace function public.is_school_member(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
      or exists (
        select 1
        from public.school_memberships sm
        where sm.school_id = target_school_id
          and sm.user_id = auth.uid()
          and sm.is_active = true
      );
$$;

create or replace function public.has_school_role(target_school_id uuid, allowed_roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
      or exists (
        select 1
        from public.school_memberships sm
        where sm.school_id = target_school_id
          and sm.user_id = auth.uid()
          and sm.is_active = true
          and sm.role = any(allowed_roles)
      );
$$;

create index school_memberships_user_id_idx on public.school_memberships(user_id);
create index school_memberships_school_id_idx on public.school_memberships(school_id);
create index academic_sessions_school_id_idx on public.academic_sessions(school_id);
create index terms_session_id_idx on public.terms(academic_session_id);
create index classes_school_id_idx on public.classes(school_id);
create index subjects_school_id_idx on public.subjects(school_id);
create index teacher_assignments_membership_id_idx on public.teacher_assignments(membership_id);

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.school_memberships enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.school_subscriptions enable row level security;
alter table public.academic_sessions enable row level security;
alter table public.terms enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.teacher_assignments enable row level security;

create policy "members can view their school"
  on public.schools for select
  using (public.is_school_member(id));

create policy "platform admins manage schools"
  on public.schools for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "members can view school memberships"
  on public.school_memberships for select
  using (public.is_school_member(school_id));

create policy "school admins manage memberships"
  on public.school_memberships for all
  using (public.has_school_role(school_id, array['school_admin','platform_admin']::public.user_role[]))
  with check (public.has_school_role(school_id, array['school_admin','platform_admin']::public.user_role[]));

create policy "members can view staff profiles"
  on public.staff_profiles for select
  using (
    exists (
      select 1 from public.school_memberships sm
      where sm.id = membership_id and public.is_school_member(sm.school_id)
    )
  );

create policy "admins manage staff profiles"
  on public.staff_profiles for all
  using (
    exists (
      select 1 from public.school_memberships sm
      where sm.id = membership_id
        and public.has_school_role(sm.school_id, array['school_admin','platform_admin']::public.user_role[])
    )
  )
  with check (
    exists (
      select 1 from public.school_memberships sm
      where sm.id = membership_id
        and public.has_school_role(sm.school_id, array['school_admin','platform_admin']::public.user_role[])
    )
  );

create policy "authenticated users view active plans"
  on public.subscription_plans for select
  to authenticated
  using (is_active = true or public.is_platform_admin());

create policy "school admins view subscriptions"
  on public.school_subscriptions for select
  using (public.is_school_member(school_id));

create policy "admins manage subscriptions"
  on public.school_subscriptions for all
  using (public.has_school_role(school_id, array['school_admin','platform_admin']::public.user_role[]))
  with check (public.has_school_role(school_id, array['school_admin','platform_admin']::public.user_role[]));

create policy "members view academic sessions"
  on public.academic_sessions for select
  using (public.is_school_member(school_id));

create policy "admins manage academic sessions"
  on public.academic_sessions for all
  using (public.has_school_role(school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[]))
  with check (public.has_school_role(school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[]));

create policy "members view terms"
  on public.terms for select
  using (
    exists (
      select 1 from public.academic_sessions s
      where s.id = academic_session_id and public.is_school_member(s.school_id)
    )
  );

create policy "admins manage terms"
  on public.terms for all
  using (
    exists (
      select 1 from public.academic_sessions s
      where s.id = academic_session_id
        and public.has_school_role(s.school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[])
    )
  )
  with check (
    exists (
      select 1 from public.academic_sessions s
      where s.id = academic_session_id
        and public.has_school_role(s.school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[])
    )
  );

create policy "members view classes"
  on public.classes for select
  using (public.is_school_member(school_id));

create policy "admins manage classes"
  on public.classes for all
  using (public.has_school_role(school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[]))
  with check (public.has_school_role(school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[]));

create policy "members view subjects"
  on public.subjects for select
  using (public.is_school_member(school_id));

create policy "admins manage subjects"
  on public.subjects for all
  using (public.has_school_role(school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[]))
  with check (public.has_school_role(school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[]));

create policy "members view teacher assignments"
  on public.teacher_assignments for select
  using (
    exists (
      select 1
      from public.school_memberships sm
      join public.classes c on c.id = class_id
      where sm.id = membership_id and c.school_id = sm.school_id and public.is_school_member(sm.school_id)
    )
  );

create policy "admins manage teacher assignments"
  on public.teacher_assignments for all
  using (
    exists (
      select 1
      from public.school_memberships sm
      join public.classes c on c.id = class_id
      where sm.id = membership_id
        and c.school_id = sm.school_id
        and public.has_school_role(sm.school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[])
    )
  )
  with check (
    exists (
      select 1
      from public.school_memberships sm
      join public.classes c on c.id = class_id
      join public.subjects sub on sub.id = subject_id
      join public.academic_sessions s on s.id = academic_session_id
      where sm.id = membership_id
        and c.school_id = sm.school_id
        and sub.school_id = sm.school_id
        and s.school_id = sm.school_id
        and public.has_school_role(sm.school_id, array['school_admin','academic_coordinator','platform_admin']::public.user_role[])
    )
  );

insert into public.subscription_plans (name, price_kobo, billing_period, max_teachers)
values ('Term Starter', 1000000, 'term', null)
on conflict (name) do nothing;

insert into public.schools (name, code, email, timezone, currency, subscription_status)
values (
  'Future Speakers International School',
  'FSIS',
  null,
  'Africa/Lagos',
  'NGN',
  'trial'
)
on conflict (code) do nothing;
