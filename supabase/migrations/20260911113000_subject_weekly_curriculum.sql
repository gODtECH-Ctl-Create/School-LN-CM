-- School LN CM: per-subject weekly curriculum structure

alter table public.curricula
  add column if not exists topics_per_week smallint not null default 1;

alter table public.curricula
  drop constraint if exists curricula_topics_per_week_valid;

alter table public.curricula
  add constraint curricula_topics_per_week_valid check (topics_per_week between 1 and 6);

alter table public.curriculum_topics
  add column if not exists topic_number smallint not null default 1;

alter table public.curriculum_topics
  drop constraint if exists curriculum_topics_topic_number_valid;

alter table public.curriculum_topics
  add constraint curriculum_topics_topic_number_valid check (topic_number between 1 and 20);

create unique index if not exists curriculum_topics_week_topic_unique
  on public.curriculum_topics(unit_id, week_number, topic_number)
  where week_number is not null;
