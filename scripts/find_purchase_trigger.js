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
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE prosrc LIKE '%cannot be modified directly%';
    `);
    console.log('Matching routines:');
    console.log(rows);
  } finally {
    await client.end();
  }
}
run().catch(console.error);
