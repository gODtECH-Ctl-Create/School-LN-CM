-- School LN CM: academic setup integrity
-- Guarantee one current academic session per school and one current term per session.

create unique index if not exists academic_sessions_one_current_per_school
  on public.academic_sessions (school_id)
  where is_current = true;

create unique index if not exists terms_one_current_per_session
  on public.terms (academic_session_id)
  where is_current = true;
