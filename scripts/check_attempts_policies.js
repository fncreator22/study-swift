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
    // 1. Get policies
    const { rows: policies } = await client.query(`
      SELECT policyname, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'test_attempts';
    `);
    console.log('Test Attempts Policies:');
    console.log(policies);

    // 2. Get triggers
    const { rows: triggers } = await client.query(`
      SELECT tgname, tgenabled, tgtype 
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      WHERE c.relname = 'test_attempts';
    `);
    console.log('Test Attempts Triggers:');
    console.log(triggers);
  } finally {
    await client.end();
  }
}
run().catch(console.error);
