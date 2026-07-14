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
  console.log("Connected. Clearing enrollments and progress for test student...");
  
  // Get student user id
  const userRes = await client.query("SELECT id FROM public.profiles WHERE email = 'student@examly.com';");
  if (userRes.rows.length === 0) {
    console.log("Student profile not found.");
    process.exit(0);
  }
  const studentId = userRes.rows[0].id;

  // Delete progress logs first (due to foreign keys)
  const enrollmentsRes = await client.query("SELECT id FROM public.course_enrollments_v2 WHERE user_id = $1;", [studentId]);
  const enrollmentIds = enrollmentsRes.rows.map(r => r.id);
  if (enrollmentIds.length > 0) {
    await client.query("DELETE FROM public.course_progress_v2 WHERE enrollment_id = ANY($1);", [enrollmentIds]);
  }

  // Delete enrollments
  await client.query("DELETE FROM public.course_enrollments_v2 WHERE user_id = $1;", [studentId]);
  console.log("Successfully cleared student test data.");
  process.exit(0);
} catch (err) {
  console.error("Execution failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
