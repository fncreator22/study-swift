import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../supabase/migrations/20260715000000_intelligent_grading.sql");

let content = readFileSync(filePath, "utf-8");

const oldUnionQuery = `  SELECT count(DISTINCT w) INTO union_count
  FROM (
    SELECT unnest(words1)
    UNION
    SELECT unnest(words2)
  ) as tmp;`;

const newUnionQuery = `  SELECT count(*) INTO union_count
  FROM (
    SELECT unnest(words1)
    UNION
    SELECT unnest(words2)
  ) as tmp;`;

content = content.replace(oldUnionQuery, newUnionQuery);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully patched intelligent_grading.sql union query!");
