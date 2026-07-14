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

    // Delete duplicates where thumbnail_url = 'Expert Python Architect'
    const res = await client.query(`
      DELETE FROM public.courses_v2 
      WHERE thumbnail_url = 'Expert Python Architect';
    `);
    console.log(`🧹 Deleted ${res.rowCount} duplicate / invalid placeholder courses from courses_v2.`);
    
    process.exit(0);
  } catch (err) {
    console.error("Cleanup failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
