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

    // 1. Fetch an enrollment ID
    const enrollRes = await client.query(`
      SELECT id, course_id FROM public.course_enrollments_v2 
      LIMIT 1;
    `);
    if (enrollRes.rows.length === 0) {
      console.log("❌ No enrollments found. Run test_grading_engine.js first.");
      process.exit(1);
    }
    const { id: enrollId, course_id: courseId } = enrollRes.rows[0];

    // Clean old feedback for this enrollment
    await client.query(`DELETE FROM public.course_feedback_v2 WHERE enrollment_id = $1;`, [enrollId]);

    // Check initial avg_rating
    const initRes = await client.query(`SELECT avg_rating FROM public.courses_v2 WHERE id = $1;`, [courseId]);
    console.log(`Initial course avg_rating: ${initRes.rows[0].avg_rating}`);

    // Insert feedback 1 (5 stars)
    console.log("➕ Inserting feedback with satisfaction_score = 5...");
    await client.query(`
      INSERT INTO public.course_feedback_v2 
        (enrollment_id, satisfaction_score, content_rating, instructor_rating, usability_rating, strengths, weaknesses, improvements, open_response)
      VALUES ($1, 5, 5, 5, 5, 'Great!', 'None', 'None', 'Excellent');
    `, [enrollId]);

    // Check updated avg_rating
    const firstUpdate = await client.query(`SELECT avg_rating FROM public.courses_v2 WHERE id = $1;`, [courseId]);
    console.log(`Updated course avg_rating (after 5-star feedback): ${firstUpdate.rows[0].avg_rating}`);

    // Update feedback to 3 stars
    console.log("🔄 Updating feedback with satisfaction_score = 3...");
    await client.query(`
      UPDATE public.course_feedback_v2 
      SET satisfaction_score = 3 
      WHERE enrollment_id = $1;
    `, [enrollId]);

    // Check final avg_rating
    const finalUpdate = await client.query(`SELECT avg_rating FROM public.courses_v2 WHERE id = $1;`, [courseId]);
    console.log(`Final course avg_rating (after updating to 3-star): ${finalUpdate.rows[0].avg_rating}`);

    if (parseFloat(finalUpdate.rows[0].avg_rating) === 3.00) {
      console.log("\n🎉 SUCCESS! Global average rating accumulator trigger is 100% functional!");
    } else {
      console.log("\n❌ FAILED! Average rating did not update correctly.");
    }

    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
