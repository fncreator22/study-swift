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
  const res = await client.query(`
    SELECT * FROM public.course_enrollments_v2 
    WHERE user_id = '0c0c2fd4-6ad4-4dde-affd-f8cd66edbc1d';
  `);
  console.log("Course Enrollments V2:", res.rows);
  process.exit(0);
} catch (err) {
  console.error("Execution failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
