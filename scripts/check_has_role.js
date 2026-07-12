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
    const { rows: funcs } = await client.query(`
      SELECT routine_name, routine_type, data_type
      FROM information_schema.routines
      WHERE routine_name LIKE '%has_role%' OR routine_name LIKE '%role%';
    `);
    console.log('Role/has_role matching routines:');
    console.log(funcs);

    // Let's also check function arguments of has_role if it exists
    const { rows: args } = await client.query(`
      SELECT r.routine_name, p.parameter_name, p.data_type, p.parameter_mode
      FROM information_schema.routines r
      JOIN information_schema.parameters p ON r.specific_name = p.specific_name
      WHERE r.routine_name LIKE '%has_role%';
    `);
    console.log('Role function parameters:');
    console.log(args);
  } finally {
    await client.end();
  }
}
run().catch(console.error);
