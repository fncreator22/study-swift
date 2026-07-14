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
  console.log("Connected to database. Applying RLS policies on public.course_enrollments_v2...");
  await client.query(`
    CREATE POLICY "enrollments_v2 insert self" ON public.course_enrollments_v2 FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  `);
  await client.query(`
    CREATE POLICY "enrollments_v2 update self" ON public.course_enrollments_v2 FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  `);
  console.log("RLS Policies applied successfully.");
  process.exit(0);
} catch (err) {
  console.error("Execution failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
