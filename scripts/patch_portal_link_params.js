import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_student.portal.$courseId.index.tsx");

let content = readFileSync(filePath, "utf-8");

// Replace all string interpolated complete links with typed TanStack Router links
content = content.replaceAll(
  'to={`/portal/${courseId}/complete`}',
  'to="/portal/$courseId/complete" params={{ courseId }}'
);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully patched portal complete links to use typed params!");
