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
    SELECT pg_get_functiondef(p.oid) 
    FROM pg_proc p 
    WHERE p.proname = 'handle_new_user';
  `);
  if (res.rows.length > 0) {
    console.log("Function Definition:\n", res.rows[0].pg_get_functiondef);
  } else {
    console.log("Function 'handle_new_user' not found!");
  }
  process.exit(0);
} catch (err) {
  console.error("Execution failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
