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
    const { rows: subs } = await client.query('SELECT id, name, price_inr, token_price FROM public.subscriptions;');
    console.log('Subscriptions:');
    console.log(subs);

    const { rows: members } = await client.query(`
      SELECT m.*, s.name as sub_name
      FROM public.memberships m
      LEFT JOIN public.subscriptions s ON m.subscription_id = s.id;
    `);
    console.log('Memberships with sub names:');
    console.log(members);
  } finally {
    await client.end();
  }
}
run().catch(console.error);
