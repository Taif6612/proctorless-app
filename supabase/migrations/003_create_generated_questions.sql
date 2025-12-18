-- generated_questions table stores per-student question variants
create table if not exists public.generated_questions (
  id uuid default gen_random_uuid() primary key,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_index integer not null,
  variant jsonb not null,
  model text,
  created_at timestamptz default now()
);

create unique index if not exists idx_generated_questions_unique
  on public.generated_questions(submission_id, question_index);