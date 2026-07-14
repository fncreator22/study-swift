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
    SELECT id, email, membership_status, tokens 
    FROM public.profiles 
    WHERE email = 'student@examly.com';
  `);
  console.log("Student Profile:", res.rows[0]);

  const mems = await client.query(`
    SELECT * FROM public.memberships WHERE user_id = $1;
  `, [res.rows[0].id]);
  console.log("Student Memberships:", mems.rows);

  process.exit(0);
} catch (err) {
  console.error("Execution failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
