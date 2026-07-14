import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new Client({
  host: "aws-0-ap-southeast-1.pooler.supabase.com",
  port: 6543,
  user: "postgres.wgjlramupisdnvyhsskd",
  password: "yscbC1XRWogLHZ2s",
  database: "postgres",
  ssl: { rejectUnauthorized: false }
});

const migrationPath = join(__dirname, "../supabase/migrations/20260715000000_intelligent_grading.sql");
const fullSql = readFileSync(migrationPath, "utf-8");

async function run() {
  try {
    await client.connect();
    console.log("✅ Connected to Supabase Postgres");

    // Execute the entire SQL migration as a single transaction batch
    await client.query("BEGIN;");
    await client.query(fullSql);
    await client.query("COMMIT;");
    
    console.log("✅ Migration file executed successfully in a single transaction!");
    
    // Verify RPCs
    const verifyRes = await client.query(`
      SELECT proname, pg_get_function_identity_arguments(oid) as args
      FROM pg_proc
      WHERE proname IN ('submit_course_assessment_v3', 'evaluate_course_assessment_attempt')
      ORDER BY proname;
    `);
    console.log("\n--- RPC Verification ---");
    verifyRes.rows.forEach(row => {
      console.log(`✅ ${row.proname}(${row.args})`);
    });
    
    process.exit(0);
  } catch (err) {
    await client.query("ROLLBACK;").catch(() => {});
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
