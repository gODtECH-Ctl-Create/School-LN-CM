-- School LN CM: school onboarding + weekly curriculum support

alter table public.subjects
  add column if not exists is_custom boolean not null default false;

alter table public.curricula
  add column if not exists week_count smallint not null default 10;

alter table public.curricula
  drop constraint if exists curricula_week_count_valid;

alter table public.curricula
  add constraint curricula_week_count_valid check (week_count between 1 and 52);

create index if not exists subjects_school_custom_idx
  on public.subjects(school_id, is_custom);

-- Common starter subjects are copied into each school during onboarding.
-- Existing schools receive the same starter vocabulary once, without overwriting custom data.
with defaults(name, code) as (
  values
    ('English Language', 'ENG'),
    ('Mathematics', 'MTH'),
    ('Basic Science', 'BSC'),
    ('Basic Technology', 'BTE'),
    ('Social Studies', 'SOS'),
    ('Civic Education', 'CIV'),
    ('Computer Studies', 'ICT'),
    ('Agricultural Science', 'AGR'),
    ('Business Studies', 'BUS'),
    ('Religious Studies', 'REL'),
    ('Physical & Health Education', 'PHE'),
    ('Geography', 'GEO'),
    ('Economics', 'ECO'),
    ('Government', 'GOV'),
    ('Literature in English', 'LIT'),
    ('Biology', 'BIO'),
    ('Chemistry', 'CHE'),
    ('Physics', 'PHY')
)
insert into public.subjects (school_id, name, code, is_custom)
select s.id, d.name, d.code, false
from public.schools s
cross join defaults d
on conflict (school_id, name) do nothing;
