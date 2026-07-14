import pg from 'pg';
import fs from 'fs';

const host = "aws-0-ap-southeast-1.pooler.supabase.com";
const user = "postgres.wgjlramupisdnvyhsskd";
const database = "postgres";
const password = "yscbC1XRWogLHZ2s";
const port = 6543;

async function run() {
  const client = new pg.Client({
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database successfully.');

    const sqlPath = './supabase/migrations/20260715000000_support_v2.sql';
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying migration sql...');
    await client.query(sqlContent);
    console.log('Migration applied successfully!');
  } catch (err) {
    console.error('Error applying migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
