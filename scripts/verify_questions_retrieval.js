import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wgjlramupisdnvyhsskd.supabase.co';
const supabaseKey = 'sb_publishable_Rn8gqvUQX9O81jsWStueOA_BLfHtupt';

async function run() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('Querying test_questions_secure as anon:');
  const { data: qs, error: err } = await supabase
    .from('test_questions_secure')
    .select('*')
    .eq('test_id', '10000000-0000-0000-0000-000000000007');
  
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Result count:', qs.length);
    console.log(qs);
  }
}
run().catch(console.error);
