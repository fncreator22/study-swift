import pg from "pg";

const connectionString = "postgresql://postgres.wgjlramupisdnvyhsskd:yscbC1XRWogLHZ2s@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    console.log("Re-defining has_active_subscription_for_course function...");
    await client.query(`
      CREATE OR REPLACE FUNCTION public.has_active_subscription_for_course(_user_id uuid, _course_id uuid)
       RETURNS boolean
       LANGUAGE sql
       STABLE SECURITY DEFINER
       SET search_path TO 'public'
      AS $function$
        SELECT EXISTS (
          SELECT 1 FROM public.memberships m
          JOIN public.subscription_courses_v2 sc ON sc.subscription_id = m.subscription_id
          WHERE m.user_id = _user_id
            AND m.status = 'active'
            AND m.valid_until > now()
            AND sc.course_id = _course_id
        )
      $function$;
    `);
    console.log("has_active_subscription_for_course defined successfully.");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    await client.end();
  }
}

run();
