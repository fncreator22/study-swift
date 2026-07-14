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
    SELECT id, title, thumbnail_url, tier 
    FROM public.courses_v2 
    ORDER BY created_at DESC;
  `);
  console.log("Courses in database:");
  res.rows.forEach(r => {
    console.log(`- ID: ${r.id}\n  Title: "${r.title}"\n  Thumbnail: "${r.thumbnail_url || 'N/A'}"\n  Tier: ${r.tier}\n`);
  });
  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await client.end();
}
