-- School LN CM: invitation-based staff identity
-- Teachers authenticate with their real email address. Staff codes remain
-- human-readable school records, not authentication credentials.

create type public.staff_invitation_status as enum (
  'provisioning',
  'pending',
  'accepted',
  'revoked',
  'expired',
  'failed'
);

create table public.school_staff_sequences (
  school_id uuid not null references public.schools(id) on delete cascade,
  role public.user_role not null,
  next_number bigint not null default 2 check (next_number > 0),
  primary key (school_id, role)
);

create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  membership_id uuid references public.school_memberships(id) on delete set null,
  email text not null,
  first_name text not null,
  last_name text not null,
  role public.user_role not null default 'teacher',
  staff_code text not null,
  status public.staff_invitation_status not null default 'provisioning',
  expires_at timestamptz not null default (now() + interval '1 hour'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_invitations_email_valid check (position('@' in email) > 1),
  constraint staff_invitations_supported_role check (role in ('teacher', 'staff'))
);

create unique index staff_invitations_pending_email_unique
  on public.staff_invitations (school_id, lower(email))
  where status in ('provisioning', 'pending');

create index staff_invitations_school_id_idx on public.staff_invitations(school_id);
create index staff_invitations_auth_user_id_idx on public.staff_invitations(auth_user_id);
create index staff_invitations_membership_id_idx on public.staff_invitations(membership_id);
create index staff_invitations_status_idx on public.staff_invitations(status);

create or replace function public.allocate_staff_code(
  target_school_id uuid,
  target_role public.user_role
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  school_code text;
  role_prefix text;
  allocated_number bigint;
begin
  select code into school_code
  from public.schools
  where id = target_school_id;

  if school_code is null then
    raise exception 'School not found';
  end if;

  role_prefix := case target_role
    when 'teacher' then 'T'
    when 'staff' then 'S'
    when 'school_admin' then 'A'
    when 'academic_coordinator' then 'A'
    else 'P'
  end;

  insert into public.school_staff_sequences (school_id, role, next_number)
  values (target_school_id, target_role, 2)
  on conflict (school_id, role)
  do update set next_number = public.school_staff_sequences.next_number + 1
  returning next_number - 1 into allocated_number;

  return format('%s-%s-%s', school_code, role_prefix, lpad(allocated_number::text, 4, '0'));
end;
$$;

revoke all on function public.allocate_staff_code(uuid, public.user_role) from public, anon, authenticated;
grant execute on function public.allocate_staff_code(uuid, public.user_role) to service_role;

alter table public.staff_invitations enable row level security;
alter table public.school_staff_sequences enable row level security;

create policy "admins view school invitations"
  on public.staff_invitations for select
  using (
    public.has_school_role(
      school_id,
      array['school_admin','platform_admin']::public.user_role[]
    )
  );

create policy "staff sequence is server managed"
  on public.school_staff_sequences for select
  using (false);

revoke all on public.staff_invitations from anon, authenticated;
revoke all on public.school_staff_sequences from anon, authenticated;
grant select on public.staff_invitations to authenticated;
