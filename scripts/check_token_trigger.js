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
    // Check triggers on token_requests
    const { rows: triggers } = await client.query(`
      SELECT tgname, proname, prosrc
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE c.relname = 'token_requests';
    `);
    console.log('Triggers on token_requests:');
    functions_print(triggers);
  } finally {
    await client.end();
  }
}
function functions_print(triggers) {
  triggers.forEach(f => {
    console.log(`--- TRIGGER: ${f.tgname} -> FUNCTION: ${f.proname} ---`);
    console.log(f.prosrc);
  });
}
run().catch(console.error);
