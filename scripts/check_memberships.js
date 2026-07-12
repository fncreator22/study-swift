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
    const { rows: columns } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'memberships';
    `);
    console.log('memberships columns:');
    console.log(columns);

    const { rows: data } = await client.query(`
      SELECT * FROM public.memberships LIMIT 5;
    `);
    console.log('memberships rows:');
    console.log(data);
  } finally {
    await client.end();
  }
}
run().catch(console.error);
