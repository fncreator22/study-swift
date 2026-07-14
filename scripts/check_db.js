import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await supabase.from("profiles").select("id, email").limit(10);
console.log("Check result (profiles):", { data, error });
process.exit(error ? 1 : 0);
