-- School LN CM: traceable curriculum imports
-- Store source metadata directly on curricula so imported teaching plans can be audited.

alter table public.curricula
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists source_reference text,
  add column if not exists source_checked_at timestamptz;

alter table public.curricula
  drop constraint if exists curricula_source_name_valid;

alter table public.curricula
  add constraint curricula_source_name_valid
  check (source_name is null or length(trim(source_name)) between 2 and 160);

create index if not exists curricula_source_name_idx
  on public.curricula(school_id, source_name)
  where source_name is not null;
