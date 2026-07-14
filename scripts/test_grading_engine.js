import pg from "pg";
const { Client } = pg;
const host = "aws-0-ap-southeast-1.pooler.supabase.com";
const user = "postgres.wgjlramupisdnvyhsskd";
const database = "postgres";
const password = "yscbC1XRWogLHZ2s";
const port = 6543;

const client = new Client({ host, port, user, password, database, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    await client.connect();
    console.log("✅ Connected to Supabase Postgres");

    // 1. Resolve or create test student
    const studentRes = await client.query(`
      SELECT id, email, full_name FROM public.profiles 
      LIMIT 1;
    `);
    if (studentRes.rows.length === 0) {
      console.log("❌ No profiles found in the database. Please sign up a user first.");
      process.exit(1);
    }
    const student = studentRes.rows[0];
    console.log(`👤 Using Candidate: ${student.full_name || 'Anonymous'} (${student.email})`);

    // Mock the authenticated user inside this Postgres transaction session
    await client.query("BEGIN;");
    await client.query("SELECT set_config('request.jwt.claim.sub', $1, true);", [student.id]);
    console.log("🔒 Mocked auth session claim sub to student ID successfully.");

    // 2. Resolve or create course
    let courseId;
    const courseRes = await client.query(`
      SELECT id, title FROM public.courses_v2 LIMIT 1;
    `);
    if (courseRes.rows.length === 0) {
      console.log("➕ Creating a test course...");
      const insertCourse = await client.query(`
        INSERT INTO public.courses_v2 (title, description, tier, pricing_tokens)
        VALUES ('Advanced React Patterns', 'Learn render props, hooks, and context.', 'free', 0)
        RETURNING id;
      `);
      courseId = insertCourse.rows[0].id;
    } else {
      courseId = courseRes.rows[0].id;
    }
    console.log(`📚 Using Course ID: ${courseId}`);

    // 3. Create or resolve enrollment with 98% progress
    let enrollId;
    const enrollRes = await client.query(`
      SELECT id FROM public.course_enrollments_v2 
      WHERE user_id = $1 AND course_id = $2;
    `, [student.id, courseId]);

    if (enrollRes.rows.length === 0) {
      console.log("➕ Creating enrollment...");
      const insertEnroll = await client.query(`
        INSERT INTO public.course_enrollments_v2 (user_id, course_id, progress_percent)
        VALUES ($1, $2, 98.00)
        RETURNING id;
      `, [student.id, courseId]);
      enrollId = insertEnroll.rows[0].id;
    } else {
      enrollId = enrollRes.rows[0].id;
      // Force progress to 98%
      await client.query(`
        UPDATE public.course_enrollments_v2 
        SET progress_percent = 98.00 
        WHERE id = $1;
      `, [enrollId]);
    }
    console.log(`🎓 Enrollment ID: ${enrollId} (Progress: 98%)`);

    // 4. Configure Course Completion Assessment
    let assessmentId;
    const asmRes = await client.query(`
      SELECT id FROM public.course_assessments_v2 WHERE course_id = $1;
    `, [courseId]);

    if (asmRes.rows.length === 0) {
      console.log("➕ Configuring Completion Assessment...");
      const insertAsm = await client.query(`
        INSERT INTO public.course_assessments_v2 (course_id, passing_score, time_limit_min)
        VALUES ($1, 80.00, 45)
        RETURNING id;
      `, [courseId]);
      assessmentId = insertAsm.rows[0].id;
    } else {
      assessmentId = asmRes.rows[0].id;
      await client.query(`
        UPDATE public.course_assessments_v2 
        SET passing_score = 80.00, time_limit_min = 45 
        WHERE id = $1;
      `, [assessmentId]);
    }
    console.log(`🏆 Assessment ID: ${assessmentId}`);

    // 5. Add Questions
    // Clean old questions
    await client.query(`DELETE FROM public.course_assessment_questions_v2 WHERE assessment_id = $1;`, [assessmentId]);
    
    // MCQ Question
    const mcqRes = await client.query(`
      INSERT INTO public.course_assessment_questions_v2 
        (assessment_id, question_text, question_type, options, correct_answers, weight, order_index)
      VALUES (
        $1, 
        'What React hook is used to cache the result of a calculation between re-renders?', 
        'mcq', 
        '[{"label": "useMemo", "value": "a"}, {"label": "useCallback", "value": "b"}, {"label": "useRef", "value": "c"}]', 
        '["a"]', 
        5.00, 
        1
      )
      RETURNING id;
    `, [assessmentId]);
    const q1Id = mcqRes.rows[0].id;

    // Written Question
    const writtenRes = await client.query(`
      INSERT INTO public.course_assessment_questions_v2 
        (assessment_id, question_text, question_type, options, correct_answers, weight, order_index)
      VALUES (
        $1, 
        'Explain what React Hooks are and their primary benefit.', 
        'written', 
        '[]', 
        '{"reference": "React Hooks are functions that let you hook into React state and lifecycle features from function components", "keywords": ["React", "hooks", "state", "lifecycle"], "min_similarity": 65.00}', 
        5.00, 
        2
      )
      RETURNING id;
    `, [assessmentId]);
    const q2Id = writtenRes.rows[0].id;
    console.log(`📝 Configured MCQ Q1 ID: ${q1Id}, Written Q2 ID: ${q2Id}`);

    // 6. Submit feedback (idempotent delete first)
    await client.query(`DELETE FROM public.course_feedback_v2 WHERE enrollment_id = $1;`, [enrollId]);
    console.log("➕ Submitting course feedback form...");
    await client.query(`
      INSERT INTO public.course_feedback_v2 
        (enrollment_id, satisfaction_score, content_rating, instructor_rating, usability_rating, strengths, weaknesses, improvements, open_response)
      VALUES ($1, 5, 5, 5, 4, 'Excellent structure and patterns.', 'None', 'Add more code exercises.', 'Highly recommended course.');
    `, [enrollId]);

    // 7. Submit academic integrity declaration
    await client.query(`DELETE FROM public.pre_assessment_declarations_v2 WHERE enrollment_id = $1;`, [enrollId]);
    console.log("➕ Submitting integrity declaration...");
    await client.query(`
      INSERT INTO public.pre_assessment_declarations_v2 (enrollment_id, ip_address, browser_agent)
      VALUES ($1, '127.0.0.1', 'NodeJS E2E Tester');
    `, [enrollId]);

    // 8. Submit candidate attempt responses
    // We clean previous attempts for this enrollment
    await client.query(`DELETE FROM public.course_assessment_attempts_v2 WHERE enrollment_id = $1;`, [enrollId]);
    
    console.log("\n🚀 SUBMITTING ASSESSMENT RESPONSES & INITIATING AUTOMATED GRADING ENGINE...");
    const responses = {};
    responses[q1Id] = "a"; // Correct MCQ
    responses[q2Id] = "React Hooks allow function components to access state and lifecycle features without writing class components."; // Written answer
    
    // Call submit_course_assessment_v3 directly via client.query mimicking student call
    const submissionResult = await client.query(`
      SELECT public.submit_course_assessment_v3($1, $2, $3, $4) as attempt_id;
    `, [courseId, student.full_name || 'E2E Candidate', '2000-01-01', JSON.stringify(responses)]);
    
    const attemptId = submissionResult.rows[0].attempt_id;
    console.log(`✅ Assessment Attempt ID created: ${attemptId}`);

    // 9. Verify results
    const attemptData = await client.query(`
      SELECT score, passed, status, grading_details, confidence_score 
      FROM public.course_assessment_attempts_v2 
      WHERE id = $1;
    `, [attemptId]);
    
    const attempt = attemptData.rows[0];
    console.log("\n--- Automated Grading Audit ---");
    console.log(`- Final Score: ${attempt.score}%`);
    console.log(`- Status: ${attempt.status}`);
    console.log(`- Passed: ${attempt.passed}`);
    console.log(`- Confidence Score: ${attempt.confidence_score}%`);
    console.log(`- Grading Details per Question:`);
    console.log(JSON.stringify(attempt.grading_details, null, 2));

    // Verify Review records
    const reviewData = await client.query(`
      SELECT status, marks_awarded, admin_notes 
      FROM public.course_assessment_reviews_v2 
      WHERE attempt_id = $1;
    `, [attemptId]);
    if (reviewData.rows.length > 0) {
      console.log(`\n✅ Review Queue Record Found!`);
      console.log(`- Marks: ${reviewData.rows[0].marks_awarded}%`);
      console.log(`- Review Notes:\n${reviewData.rows[0].admin_notes}`);
    } else {
      console.log(`❌ No Review Queue Record Found!`);
    }

    // Verify Certificate
    const certData = await client.query(`
      SELECT id, certificate_number, recipient_name, issued_at 
      FROM public.course_certificates_v2 
      WHERE enrollment_id = $1;
    `, [enrollId]);
    
    if (certData.rows.length > 0) {
      const c = certData.rows[0];
      console.log(`\n🎉 CERTIFICATE GENERATED SUCCESS!`);
      console.log(`- Number: ${c.certificate_number}`);
      console.log(`- Recipient: ${c.recipient_name}`);
      console.log(`- Issued: ${c.issued_at}`);
    } else {
      console.log(`\n❌ NO CERTIFICATE GENERATED (Ensure score >= passing_score)`);
    }

    await client.query("COMMIT;");
    console.log("\n✅ E2E transaction committed successfully!");
    process.exit(0);
  } catch (err) {
    await client.query("ROLLBACK;").catch(() => {});
    console.error("❌ E2E Verification failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
