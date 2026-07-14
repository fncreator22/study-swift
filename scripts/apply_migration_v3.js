import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new Client({
  host: "aws-0-ap-southeast-1.pooler.supabase.com",
  port: 6543,
  user: "postgres.wgjlramupisdnvyhsskd",
  password: "yscbC1XRWogLHZ2s",
  database: "postgres",
  ssl: { rejectUnauthorized: false }
});

// Read the migration file
const migrationPath = join(__dirname, "../supabase/migrations/20260714000000_course_module_v3.sql");
const fullSql = readFileSync(migrationPath, "utf-8");

// Split into sections by the separator comments
const sections = [
  {
    name: "BLOCK 1 — courses_v2 new columns",
    sql: `ALTER TABLE public.courses_v2
  ADD COLUMN IF NOT EXISTS subtitle          TEXT         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS skills_learned    TEXT[]       DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS faqs              JSONB        DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS last_updated      DATE,
  ADD COLUMN IF NOT EXISTS enrollment_count  INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating        NUMERIC(3,2) NOT NULL DEFAULT 0.00;`
  },
  {
    name: "BLOCK 2 — subscription_tiers table + RLS",
    sql: `CREATE TABLE IF NOT EXISTS public.subscription_tiers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID        NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  tier            TEXT        NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_subscription_tier UNIQUE (subscription_id, tier)
);
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_sub  ON public.subscription_tiers(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_tier ON public.subscription_tiers(tier);
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subscription_tiers' AND policyname='subscription_tiers read authenticated') THEN
    CREATE POLICY "subscription_tiers read authenticated" ON public.subscription_tiers FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subscription_tiers' AND policyname='subscription_tiers admin all') THEN
    CREATE POLICY "subscription_tiers admin all" ON public.subscription_tiers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END;
$$;`
  },
  {
    name: "BLOCK 3 — personal_notes_v2 table + RLS",
    sql: `CREATE TABLE IF NOT EXISTS public.personal_notes_v2 (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID        NOT NULL REFERENCES public.course_enrollments_v2(id) ON DELETE CASCADE,
  lesson_id     UUID        NOT NULL REFERENCES public.course_lessons_v2(id) ON DELETE CASCADE,
  note_text     TEXT        NOT NULL DEFAULT '',
  updated_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_enrollment_lesson_note UNIQUE (enrollment_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_personal_notes_v2_enrollment ON public.personal_notes_v2(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_personal_notes_v2_lesson     ON public.personal_notes_v2(lesson_id);
ALTER TABLE public.personal_notes_v2 ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='personal_notes_v2' AND policyname='personal_notes_v2 read own') THEN
    CREATE POLICY "personal_notes_v2 read own" ON public.personal_notes_v2 FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.course_enrollments_v2 e WHERE e.id = enrollment_id AND e.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='personal_notes_v2' AND policyname='personal_notes_v2 insert own') THEN
    CREATE POLICY "personal_notes_v2 insert own" ON public.personal_notes_v2 FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.course_enrollments_v2 e WHERE e.id = enrollment_id AND e.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='personal_notes_v2' AND policyname='personal_notes_v2 update own') THEN
    CREATE POLICY "personal_notes_v2 update own" ON public.personal_notes_v2 FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.course_enrollments_v2 e WHERE e.id = enrollment_id AND e.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.course_enrollments_v2 e WHERE e.id = enrollment_id AND e.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='personal_notes_v2' AND policyname='personal_notes_v2 delete own') THEN
    CREATE POLICY "personal_notes_v2 delete own" ON public.personal_notes_v2 FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.course_enrollments_v2 e WHERE e.id = enrollment_id AND e.user_id = auth.uid()));
  END IF;
END;
$$;`
  },
  {
    name: "BLOCK 4 — attempts status column + course_assessment_reviews_v2 table + RLS",
    sql: `ALTER TABLE public.course_assessment_attempts_v2
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'resubmit'));

CREATE TABLE IF NOT EXISTS public.course_assessment_reviews_v2 (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id    UUID         NOT NULL REFERENCES public.course_assessment_attempts_v2(id) ON DELETE CASCADE UNIQUE,
  reviewer_id   UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        TEXT         NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'rejected', 'resubmit')),
  marks_awarded NUMERIC(5,2) NOT NULL DEFAULT 0,
  admin_notes   TEXT         NOT NULL DEFAULT '',
  reviewed_at   TIMESTAMPTZ  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assessment_reviews_v2_attempt  ON public.course_assessment_reviews_v2(attempt_id);
CREATE INDEX IF NOT EXISTS idx_assessment_reviews_v2_reviewer ON public.course_assessment_reviews_v2(reviewer_id);
ALTER TABLE public.course_assessment_reviews_v2 ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='course_assessment_reviews_v2' AND policyname='assessment_reviews_v2 read own') THEN
    CREATE POLICY "assessment_reviews_v2 read own" ON public.course_assessment_reviews_v2 FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.course_assessment_attempts_v2 a JOIN public.course_enrollments_v2 e ON e.id = a.enrollment_id WHERE a.id = attempt_id AND e.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='course_assessment_reviews_v2' AND policyname='assessment_reviews_v2 admin all') THEN
    CREATE POLICY "assessment_reviews_v2 admin all" ON public.course_assessment_reviews_v2 FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END;
$$;`
  },
  {
    name: "BLOCK 5 — enroll_in_course_v3 RPC",
    sql: `CREATE OR REPLACE FUNCTION public.enroll_in_course_v3(_course_id UUID)
RETURNS TABLE(enrollment_id UUID, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid       UUID;
  _tier      TEXT;
  _price     INT;
  _balance   INT;
  _enroll_id UUID;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM set_config('app.bypass_token_lock', 'true', true);

  SELECT ce.id INTO _enroll_id
  FROM public.course_enrollments_v2 ce
  WHERE ce.user_id = _uid AND ce.course_id = _course_id;

  IF _enroll_id IS NOT NULL THEN
    RETURN QUERY SELECT _enroll_id, 'already_enrolled'::TEXT;
    RETURN;
  END IF;

  SELECT c.tier, c.pricing_tokens INTO _tier, _price
  FROM public.courses_v2 c WHERE c.id = _course_id;

  IF _tier IS NULL THEN
    RAISE EXCEPTION 'Course not found: %', _course_id;
  END IF;

  IF _tier = 'free' OR _price = 0 THEN
    INSERT INTO public.course_enrollments_v2 (user_id, course_id) VALUES (_uid, _course_id) RETURNING id INTO _enroll_id;
    UPDATE public.courses_v2 SET enrollment_count = enrollment_count + 1 WHERE id = _course_id;
    RETURN QUERY SELECT _enroll_id, 'enrolled'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.subscription_tiers st ON st.subscription_id = m.subscription_id
    WHERE m.user_id = _uid AND m.status = 'active' AND m.valid_until > now() AND st.tier = _tier
  ) THEN
    INSERT INTO public.course_enrollments_v2 (user_id, course_id) VALUES (_uid, _course_id) RETURNING id INTO _enroll_id;
    UPDATE public.courses_v2 SET enrollment_count = enrollment_count + 1 WHERE id = _course_id;
    RETURN QUERY SELECT _enroll_id, 'enrolled_via_subscription'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.subscription_courses_v2 sc ON sc.subscription_id = m.subscription_id
    WHERE m.user_id = _uid AND m.status = 'active' AND m.valid_until > now() AND sc.course_id = _course_id
  ) THEN
    INSERT INTO public.course_enrollments_v2 (user_id, course_id) VALUES (_uid, _course_id) RETURNING id INTO _enroll_id;
    UPDATE public.courses_v2 SET enrollment_count = enrollment_count + 1 WHERE id = _course_id;
    RETURN QUERY SELECT _enroll_id, 'enrolled_via_subscription'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.purchases p WHERE p.user_id = _uid AND p.course_id = _course_id) THEN
    INSERT INTO public.course_enrollments_v2 (user_id, course_id) VALUES (_uid, _course_id) RETURNING id INTO _enroll_id;
    UPDATE public.courses_v2 SET enrollment_count = enrollment_count + 1 WHERE id = _course_id;
    RETURN QUERY SELECT _enroll_id, 'enrolled_via_purchase'::TEXT;
    RETURN;
  END IF;

  SELECT tokens INTO _balance FROM public.profiles WHERE id = _uid FOR UPDATE;

  IF _balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user: %', _uid;
  END IF;

  IF _balance < _price THEN
    RAISE EXCEPTION 'Insufficient tokens. Required: %, Balance: %', _price, _balance;
  END IF;

  UPDATE public.profiles SET tokens = tokens - _price WHERE id = _uid;
  INSERT INTO public.purchases (user_id, course_id) VALUES (_uid, _course_id);
  INSERT INTO public.wallet_transactions (user_id, amount, type, description)
    VALUES (_uid, -_price, 'purchase', 'Course enrollment: ' || _course_id::text);
  INSERT INTO public.course_enrollments_v2 (user_id, course_id) VALUES (_uid, _course_id) RETURNING id INTO _enroll_id;
  UPDATE public.courses_v2 SET enrollment_count = enrollment_count + 1 WHERE id = _course_id;
  RETURN QUERY SELECT _enroll_id, 'enrolled'::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION public.enroll_in_course_v3(UUID) TO authenticated;`
  },
  {
    name: "BLOCK 6 — submit_course_assessment_v3 RPC",
    sql: `CREATE OR REPLACE FUNCTION public.submit_course_assessment_v3(
  _course_id   UUID,
  _locked_name TEXT,
  _locked_dob  DATE,
  _responses   JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid           UUID;
  _enroll_id     UUID;
  _progress      NUMERIC;
  _assessment_id UUID;
  _attempt_id    UUID;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, progress_percent INTO _enroll_id, _progress
  FROM public.course_enrollments_v2
  WHERE user_id = _uid AND course_id = _course_id;

  IF _enroll_id IS NULL THEN
    RAISE EXCEPTION 'Enrollment not found. You must be enrolled in this course to submit an assessment.';
  END IF;

  IF (_progress / 100.0) < 0.95 THEN
    RAISE EXCEPTION 'Course progress insufficient. Required: 95%%, Current: %', _progress;
  END IF;

  SELECT id INTO _assessment_id
  FROM public.course_assessments_v2
  WHERE course_id = _course_id;

  IF _assessment_id IS NULL THEN
    RAISE EXCEPTION 'No assessment configured for this course.';
  END IF;

  INSERT INTO public.course_assessment_attempts_v2
    (enrollment_id, locked_full_name, locked_dob, responses, status)
  VALUES
    (_enroll_id, _locked_name, _locked_dob, _responses, 'submitted')
  RETURNING id INTO _attempt_id;

  UPDATE public.profiles
  SET full_name = _locked_name, date_of_birth = _locked_dob
  WHERE id = _uid AND date_of_birth IS NULL;

  RETURN _attempt_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_course_assessment_v3(UUID, TEXT, DATE, JSONB) TO authenticated;`
  },
  {
    name: "BLOCK 7 — admin_approve_assessment_v3 RPC",
    sql: `CREATE OR REPLACE FUNCTION public.admin_approve_assessment_v3(
  _attempt_id    UUID,
  _marks_awarded NUMERIC,
  _admin_notes   TEXT,
  _action        TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid          UUID;
  _enroll_id    UUID;
  _locked_name  TEXT;
  _locked_dob   DATE;
  _score        NUMERIC(5,2);
  _course_id    UUID;
  _course_title TEXT;
  _cert_number  TEXT;
  _verify_hash  TEXT;
  _cert_id      UUID;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT public.has_role(_uid, 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF _action NOT IN ('approved', 'rejected', 'resubmit') THEN
    RAISE EXCEPTION 'Invalid action. Must be one of: approved, rejected, resubmit';
  END IF;

  UPDATE public.course_assessment_attempts_v2 SET status = _action WHERE id = _attempt_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found: %', _attempt_id;
  END IF;

  INSERT INTO public.course_assessment_reviews_v2
    (attempt_id, reviewer_id, status, marks_awarded, admin_notes, reviewed_at)
  VALUES
    (_attempt_id, _uid, _action, _marks_awarded, COALESCE(_admin_notes, ''), now())
  ON CONFLICT (attempt_id)
  DO UPDATE SET
    reviewer_id   = EXCLUDED.reviewer_id,
    status        = EXCLUDED.status,
    marks_awarded = EXCLUDED.marks_awarded,
    admin_notes   = EXCLUDED.admin_notes,
    reviewed_at   = EXCLUDED.reviewed_at;

  IF _action <> 'approved' THEN
    RETURN NULL;
  END IF;

  SELECT a.enrollment_id, a.locked_full_name, a.locked_dob, a.score
    INTO _enroll_id, _locked_name, _locked_dob, _score
  FROM public.course_assessment_attempts_v2 a WHERE a.id = _attempt_id;

  SELECT c.id, c.title INTO _course_id, _course_title
  FROM public.course_enrollments_v2 e
  JOIN public.courses_v2 c ON c.id = e.course_id
  WHERE e.id = _enroll_id;

  _cert_number := 'EX-' || UPPER(SUBSTRING(MD5(_attempt_id::text), 1, 8)) || '-' || EXTRACT(YEAR FROM now())::text;
  _verify_hash := MD5(_attempt_id::text || now()::text);

  INSERT INTO public.course_certificates_v2
    (enrollment_id, certificate_number, recipient_name, date_of_birth, final_score, verification_hash)
  VALUES
    (_enroll_id, _cert_number, _locked_name, _locked_dob, _marks_awarded, _verify_hash)
  ON CONFLICT (enrollment_id)
  DO UPDATE SET final_score = EXCLUDED.final_score, issued_at = now()
  RETURNING id INTO _cert_id;

  RETURN _cert_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_approve_assessment_v3(UUID, NUMERIC, TEXT, TEXT) TO authenticated;`
  },
  {
    name: "BLOCK 8 — has_course_access_v2 update + enrollment trigger",
    sql: `CREATE OR REPLACE FUNCTION public.has_course_access_v2(_user_id UUID, _course_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tier TEXT;
BEGIN
  SELECT tier INTO _tier FROM public.courses_v2 WHERE id = _course_id;

  RETURN (
    public.has_role(_user_id, 'admin')
    OR EXISTS (SELECT 1 FROM public.courses_v2 WHERE id = _course_id AND tier = 'free')
    OR EXISTS (SELECT 1 FROM public.purchases WHERE user_id = _user_id AND course_id = _course_id)
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      JOIN public.subscription_courses_v2 sc ON sc.subscription_id = m.subscription_id
      WHERE m.user_id = _user_id AND m.status = 'active' AND m.valid_until > now() AND sc.course_id = _course_id
    )
    OR (_tier IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.memberships m
      JOIN public.subscription_tiers st ON st.subscription_id = m.subscription_id
      WHERE m.user_id = _user_id AND m.status = 'active' AND m.valid_until > now() AND st.tier = _tier
    ))
    OR EXISTS (
      SELECT 1 FROM public.course_enrollments_v2
      WHERE user_id = _user_id AND course_id = _course_id
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_course_enrollment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.courses_v2 SET enrollment_count = enrollment_count + 1 WHERE id = NEW.course_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_enrollment_count ON public.course_enrollments_v2;
CREATE TRIGGER trg_update_enrollment_count
  AFTER INSERT ON public.course_enrollments_v2
  FOR EACH ROW EXECUTE FUNCTION public.update_course_enrollment_count();`
  }
];

async function run() {
  try {
    await client.connect();
    console.log("✅ Connected to Supabase Postgres\n");

    let passed = 0;
    let failed = 0;

    for (const section of sections) {
      try {
        await client.query(section.sql);
        console.log(`✅ ${section.name}`);
        passed++;
      } catch (err) {
        // "already exists" errors are acceptable for idempotent operations
        const isIdempotent = err.message.includes("already exists") || 
                              err.message.includes("duplicate key") ||
                              err.message.includes("already set");
        if (isIdempotent) {
          console.log(`⚠️  ${section.name} — already exists (skipped)`);
          passed++;
        } else {
          console.error(`❌ ${section.name}`);
          console.error(`   Error: ${err.message}`);
          failed++;
        }
      }
    }

    console.log(`\n--- Migration Complete ---`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);

    // Verify the 3 key RPCs were created
    const verifyRes = await client.query(`
      SELECT proname, pg_get_function_identity_arguments(oid) as args
      FROM pg_proc
      WHERE proname IN ('enroll_in_course_v3', 'submit_course_assessment_v3', 'admin_approve_assessment_v3')
      ORDER BY proname;
    `);
    console.log("\n--- RPC Verification ---");
    if (verifyRes.rows.length === 0) {
      console.log("❌ None of the 3 RPCs found!");
    } else {
      verifyRes.rows.forEach(row => {
        console.log(`✅ ${row.proname}(${row.args})`);
      });
    }

    // Verify new tables
    const tablesRes = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('subscription_tiers', 'personal_notes_v2', 'course_assessment_reviews_v2')
      ORDER BY tablename;
    `);
    console.log("\n--- Table Verification ---");
    tablesRes.rows.forEach(row => console.log(`✅ ${row.tablename}`));
    if (tablesRes.rows.length < 3) {
      const found = tablesRes.rows.map(r => r.tablename);
      ['subscription_tiers', 'personal_notes_v2', 'course_assessment_reviews_v2'].forEach(t => {
        if (!found.includes(t)) console.log(`❌ ${t} — NOT FOUND`);
      });
    }

    // Verify new columns in courses_v2
    const colsRes = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'courses_v2'
        AND column_name IN ('subtitle', 'skills_learned', 'faqs', 'enrollment_count', 'avg_rating')
      ORDER BY column_name;
    `);
    console.log("\n--- courses_v2 Column Verification ---");
    colsRes.rows.forEach(row => console.log(`✅ courses_v2.${row.column_name}`));

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("Connection failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
