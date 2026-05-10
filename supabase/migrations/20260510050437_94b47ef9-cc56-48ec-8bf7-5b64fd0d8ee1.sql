-- Tests: add type + word limit
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS test_type text NOT NULL DEFAULT 'mcq',
  ADD COLUMN IF NOT EXISTS word_limit integer NOT NULL DEFAULT 500;

ALTER TABLE public.tests
  DROP CONSTRAINT IF EXISTS tests_test_type_check;
ALTER TABLE public.tests
  ADD CONSTRAINT tests_test_type_check CHECK (test_type IN ('mcq','written'));

-- Questions: add type + max_words, relax MCQ-only columns
ALTER TABLE public.test_questions
  ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'mcq',
  ADD COLUMN IF NOT EXISTS max_words integer;

ALTER TABLE public.test_questions
  ALTER COLUMN option_a DROP NOT NULL,
  ALTER COLUMN option_b DROP NOT NULL,
  ALTER COLUMN option_c DROP NOT NULL,
  ALTER COLUMN option_d DROP NOT NULL,
  ALTER COLUMN correct_option DROP NOT NULL;

ALTER TABLE public.test_questions
  DROP CONSTRAINT IF EXISTS test_questions_question_type_check;
ALTER TABLE public.test_questions
  ADD CONSTRAINT test_questions_question_type_check CHECK (question_type IN ('mcq','written'));

-- Answers: written essay text
ALTER TABLE public.test_answers
  ADD COLUMN IF NOT EXISTS written_answer text;