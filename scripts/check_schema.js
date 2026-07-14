import pg from "pg";
const { Client } = pg;
const host = "aws-0-ap-southeast-1.pooler.supabase.com";
const user = "postgres.wgjlramupisdnvyhsskd";
const database = "postgres";
const password = "yscbC1XRWogLHZ2s";
const port = 6543;

const client = new Client({ host, port, user, password, database, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'course_feedback_v2' 
    ORDER BY column_name;
  `);
  console.log("Columns of course_feedback_v2:");
  res.rows.forEach(r => console.log(`- ${r.column_name}: ${r.data_type}`));
  
  const res2 = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'course_assessment_questions_v2' 
    ORDER BY column_name;
  `);
  console.log("\nColumns of course_assessment_questions_v2:");
  res2.rows.forEach(r => console.log(`- ${r.column_name}: ${r.data_type}`));
  
  const res3 = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'course_assessment_attempts_v2' 
    ORDER BY column_name;
  `);
  console.log("\nColumns of course_assessment_attempts_v2:");
  res3.rows.forEach(r => console.log(`- ${r.column_name}: ${r.data_type}`));

  const res4 = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'course_assessments_v2' 
    ORDER BY column_name;
  `);
  console.log("\nColumns of course_assessments_v2:");
  res4.rows.forEach(r => console.log(`- ${r.column_name}: ${r.data_type}`));

  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await client.end();
}
