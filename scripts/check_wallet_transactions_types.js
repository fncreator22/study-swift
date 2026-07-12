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
      SELECT cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_name = 'wallet_transactions';
    `);
    console.log(rows);
  } finally {
    await client.end();
  }
}
run().catch(console.error);
