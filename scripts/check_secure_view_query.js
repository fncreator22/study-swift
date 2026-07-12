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
    // Let's check if there are actually any questions in public.test_questions for the Git test (10000000-0000-0000-0000-000000000007)
    const { rows: directQs } = await client.query(`
      SELECT id, question, test_id FROM public.test_questions WHERE test_id = '10000000-0000-0000-0000-000000000007';
    `);
    console.log('Direct test questions count:', directQs.length);
    console.log(directQs);

    // Let's check what auth.uid() is returning in normal contexts
    // Let's run a transaction, simulate a logged-in user, and select from public.test_questions_secure!
    // We will use Sagar's user ID: '4d27d616-ee5b-4474-86d2-0f42565e4284'
    await client.query('BEGIN;');
    await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"4d27d616-ee5b-4474-86d2-0f42565e4284\"}', true);");
    
    // Now let's see if auth.uid() is correctly populated in this transaction context
    const { rows: uidVal } = await client.query('SELECT auth.uid();');
    console.log('auth.uid() inside transaction:', uidVal[0]);

    // Let's check has_test_access for Sagar and this test
    const { rows: access } = await client.query(`
      SELECT public.has_test_access(auth.uid(), '10000000-0000-0000-0000-000000000007') as access_val;
    `);
    console.log('has_test_access in transaction:', access[0]);

    // Let's check the view
    const { rows: viewQs } = await client.query(`
      SELECT id, question FROM public.test_questions_secure WHERE test_id = '10000000-0000-0000-0000-000000000007';
    `);
    console.log('test_questions_secure in transaction count:', viewQs.length);
    console.log(viewQs);

    await client.query('COMMIT;');
  } catch (e) {
    await client.query('ROLLBACK;');
    console.error(e);
  } finally {
    await client.end();
  }
}
run().catch(console.error);
