import pg from 'pg';

const config = {
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.wgjlramupisdnvyhsskd',
  database: 'postgres',
  password: 'b6mr!K3*GBmTsNe',
  ssl: { rejectUnauthorized: false }
};

async function run() {
  const client = new pg.Client(config);
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT * FROM public.bug_reports WHERE created_at > '2026-07-12 18:00:00+00' ORDER BY created_at DESC;
    `);
    console.log("TODAYS BUG REPORTS:", rows);
  } finally {
    await client.end();
  }
}
run().catch(console.error);
