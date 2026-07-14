import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_student.tsx");

let content = readFileSync(filePath, "utf-8");

// Rename "Purchased" to "My Learning" and change icon to BookOpen
content = content.replace(
  '{ to: "/purchased", label: "Purchased", icon: CheckCircle },',
  '{ to: "/purchased", label: "My Learning", icon: BookOpen },'
);

content = content.replace(
  '{ to: "/purchased", label: "My Purchased Items", icon: CheckCircle },',
  '{ to: "/purchased", label: "My Learning", icon: BookOpen },'
);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully updated student sidebar menu labels to 'My Learning'!");
