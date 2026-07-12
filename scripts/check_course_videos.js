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
      SELECT id, title, video_url, storage_path, text_content FROM public.videos WHERE course_id = '20000000-0000-0000-0000-000000000007' ORDER BY position;
    `);
    console.log("VIDEOS FOR DOCKER COURSE:", rows);
  } finally {
    await client.end();
  }
}
run().catch(console.error);
