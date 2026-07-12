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
    const { rows: purchases } = await client.query(`
      SELECT * FROM public.purchases;
    `);
    console.log("ALL PURCHASES:", purchases);

    const { rows: profiles } = await client.query(`
      SELECT id, email, membership_status, subscription_expiry FROM public.profiles;
    `);
    console.log("PROFILES:", profiles);
  } finally {
    await client.end();
  }
}
run().catch(console.error);
