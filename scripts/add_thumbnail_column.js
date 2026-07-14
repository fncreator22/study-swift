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
  console.log("Connected to database. Adding thumbnail_url column...");
  await client.query("ALTER TABLE public.courses_v2 ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;");
  console.log("Column added. Syncing data...");
  await client.query("UPDATE public.courses_v2 SET thumbnail_url = c.thumbnail_url FROM public.courses c WHERE public.courses_v2.id = c.id;");
  console.log("Sync complete.");
  process.exit(0);
} catch (err) {
  console.error("Execution failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
