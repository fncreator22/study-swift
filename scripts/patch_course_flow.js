import pg from "pg";
const { Client } = pg;

const host = "aws-0-ap-southeast-1.pooler.supabase.com";
const user = "postgres.wgjlramupisdnvyhsskd";
const database = "postgres";
const password = "yscbC1XRWogLHZ2s";
const port = 6543;

const client = new Client({ host, port, user, password, database, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log("Connected to database. Executing Course Flow V2 fixes...");

  // 0. Update purchases course_id foreign key constraint to target courses_v2
  console.log("Updating purchases.course_id foreign key constraint to target courses_v2...");
  await client.query(`
    ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_course_id_fkey;
    ALTER TABLE public.purchases ADD CONSTRAINT purchases_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses_v2(id) ON DELETE CASCADE;
  `);

  // 1. Redefine purchase_with_tokens to reference courses_v2.pricing_tokens
  console.log("Updating purchase_with_tokens RPC...");
  await client.query(`
    CREATE OR REPLACE FUNCTION public.purchase_with_tokens(_test_id uuid, _course_id uuid)
     RETURNS jsonb
     LANGUAGE plpgsql
     SECURITY DEFINER
    AS $function$
    DECLARE
      v_user uuid := auth.uid();
      v_price numeric := 0;
      v_tier text;
      v_balance int;
      v_cost int;
      v_purchase_id uuid;
    BEGIN
      IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
      IF (_test_id IS NULL) = (_course_id IS NULL) THEN
        RAISE EXCEPTION 'Provide exactly one of test_id or course_id';
      END IF;

      -- Set bypass lock
      PERFORM set_config('app.bypass_token_lock', 'true', true);

      IF _test_id IS NOT NULL THEN
        SELECT price, tier::text INTO v_price, v_tier FROM public.tests WHERE id = _test_id;
        IF v_tier IS NULL THEN RAISE EXCEPTION 'Test not found'; END IF;
        IF v_tier = 'free' THEN RAISE EXCEPTION 'Test is free'; END IF;
        IF EXISTS (SELECT 1 FROM public.purchases WHERE user_id = v_user AND test_id = _test_id) THEN
          RAISE EXCEPTION 'Already purchased';
        END IF;
        v_cost := v_price::int;
      ELSE
        -- Fixed: Select from public.courses_v2 pricing_tokens
        SELECT pricing_tokens, tier INTO v_cost, v_tier FROM public.courses_v2 WHERE id = _course_id;
        IF v_tier IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;
        IF v_tier = 'free' THEN RAISE EXCEPTION 'Course is free'; END IF;
        IF EXISTS (SELECT 1 FROM public.purchases WHERE user_id = v_user AND course_id = _course_id) THEN
          RAISE EXCEPTION 'Already purchased';
        END IF;
      END IF;

      SELECT tokens INTO v_balance FROM public.profiles WHERE id = v_user FOR UPDATE;
      IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile missing'; END IF;
      IF v_balance < v_cost THEN RAISE EXCEPTION 'Insufficient tokens'; END IF;

      UPDATE public.profiles SET tokens = tokens - v_cost WHERE id = v_user;

      INSERT INTO public.purchases (user_id, test_id, course_id)
      VALUES (v_user, _test_id, _course_id)
      RETURNING id INTO v_purchase_id;

      INSERT INTO public.wallet_transactions (user_id, amount, type, description)
      VALUES (v_user, -v_cost, 'purchase',
              CASE WHEN _test_id IS NOT NULL THEN 'Test purchase' ELSE 'Course purchase' END);

      RETURN jsonb_build_object('purchase_id', v_purchase_id, 'spent', v_cost);
    END;
    $function$;
  `);

  // 2. Create recalculation progress trigger function
  console.log("Creating handle_course_progress_recalculation function...");
  await client.query(`
    CREATE OR REPLACE FUNCTION public.handle_course_progress_recalculation()
     RETURNS trigger
     LANGUAGE plpgsql
     SECURITY DEFINER
    AS $$
    DECLARE
      v_enrollment_id uuid;
      v_course_id uuid;
      v_total_lessons int := 0;
      v_completed_lessons int := 0;
      v_pct numeric(5,2) := 0.00;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        v_enrollment_id := OLD.enrollment_id;
      ELSE
        v_enrollment_id := NEW.enrollment_id;
      END IF;

      -- Get course_id for this enrollment
      SELECT course_id INTO v_course_id 
        FROM public.course_enrollments_v2 
       WHERE id = v_enrollment_id;

      IF v_course_id IS NOT NULL THEN
        -- Count total lessons in curriculum for this course
        SELECT count(l.id) INTO v_total_lessons 
          FROM public.course_lessons_v2 l
          JOIN public.course_modules_v2 m ON m.id = l.module_id
         WHERE m.course_id = v_course_id;

        -- Count completed lessons for this student enrollment
        SELECT count(id) INTO v_completed_lessons 
          FROM public.course_progress_v2 
         WHERE enrollment_id = v_enrollment_id;

        -- Calculate percentage
        IF v_total_lessons > 0 THEN
          v_pct := round((v_completed_lessons::numeric / v_total_lessons::numeric) * 100.00, 2);
        ELSE
          v_pct := 0.00;
        END IF;

        -- Update enrollment status
        UPDATE public.course_enrollments_v2 
           SET progress_percent = v_pct,
               last_accessed_at = now(),
               status = CASE WHEN v_pct >= 100.00 THEN 'completed'::text ELSE 'active'::text END
         WHERE id = v_enrollment_id;
      END IF;
      
      RETURN NULL;
    END;
    $$;
  `);

  console.log("Attaching recalculation trigger to course_progress_v2...");
  await client.query(`
    DROP TRIGGER IF EXISTS trg_recalculate_course_progress ON public.course_progress_v2;
    CREATE TRIGGER trg_recalculate_course_progress
      AFTER INSERT OR DELETE ON public.course_progress_v2
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_course_progress_recalculation();
  `);

  // 3. Create handle_test_attempt_grading_v2 trigger function
  console.log("Creating handle_test_attempt_grading_v2 function...");
  await client.query(`
    CREATE OR REPLACE FUNCTION public.handle_test_attempt_grading_v2()
     RETURNS trigger
     LANGUAGE plpgsql
     SECURITY DEFINER
    AS $$
    DECLARE
      v_course_id uuid;
      v_enrollment_id uuid;
      v_passing_score numeric := 80.00;
      v_score_pct numeric;
      v_full_name text;
      v_dob date;
      v_cert_number text;
      v_hash text;
    BEGIN
      -- We only generate/update certificates when the attempt is finalized/reviewed and published
      IF NEW.is_reviewed = true AND (OLD.is_reviewed = false OR OLD.is_reviewed IS DISTINCT FROM NEW.is_reviewed) THEN
        -- Check if this test is linked to any course as a completion certificate exam
        SELECT id INTO v_course_id 
          FROM public.courses_v2 
         WHERE completion_test_id = NEW.test_id 
         LIMIT 1;

        IF v_course_id IS NOT NULL THEN
          -- Fetch the enrollment ID for this user and course
          SELECT id INTO v_enrollment_id 
            FROM public.course_enrollments_v2 
           WHERE user_id = NEW.user_id AND course_id = v_course_id 
           LIMIT 1;

          IF v_enrollment_id IS NOT NULL THEN
            -- Get the passing score for the course assessment
            SELECT passing_score INTO v_passing_score 
              FROM public.course_assessments_v2 
             WHERE course_id = v_course_id 
             LIMIT 1;
             
            IF v_passing_score IS NULL THEN
              v_passing_score := 80.00;
            END IF;

            -- Calculate percentage score
            IF NEW.total > 0 THEN
              v_score_pct := (NEW.score::numeric / NEW.total::numeric) * 100.00;
            ELSE
              v_score_pct := 0.00;
            END IF;

            -- Only generate certificate if final score meets passing threshold
            IF v_score_pct >= v_passing_score THEN
              -- Fetch recipient profile info
              SELECT full_name, date_of_birth INTO v_full_name, v_dob 
                FROM public.profiles 
               WHERE id = NEW.user_id;

              v_cert_number := upper(substring(md5(random()::text) from 1 for 10));
              v_hash := md5(random()::text);

              -- Upsert certificate V2
              INSERT INTO public.course_certificates_v2 (
                enrollment_id, 
                certificate_number, 
                recipient_name, 
                date_of_birth, 
                final_score, 
                verification_hash
              )
              VALUES (
                v_enrollment_id, 
                v_cert_number, 
                COALESCE(v_full_name, 'Student'), 
                COALESCE(v_dob, '2000-01-01'::date), 
                v_score_pct, 
                v_hash
              )
              ON CONFLICT (enrollment_id) 
              DO UPDATE SET 
                final_score = v_score_pct,
                issued_at = now();
            ELSE
              -- If they failed, delete any pre-existing certificate
              DELETE FROM public.course_certificates_v2 WHERE enrollment_id = v_enrollment_id;
            END IF;
          END IF;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$;
  `);

  console.log("Attaching grading trigger to test_attempts...");
  await client.query(`
    DROP TRIGGER IF EXISTS trg_generate_certificate_on_grading_v2 ON public.test_attempts;
    CREATE TRIGGER trg_generate_certificate_on_grading_v2
      AFTER UPDATE ON public.test_attempts
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_test_attempt_grading_v2();
  `);

  console.log("Course Flow V2 fixes applied successfully.");
  process.exit(0);
} catch (err) {
  console.error("Execution failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
