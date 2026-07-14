import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_admin.tsx");

let content = readFileSync(filePath, "utf-8");

// Append GraduationCap to the lucide-react import block
content = content.replace(
  'ShieldAlert } from "lucide-react";',
  'ShieldAlert, GraduationCap } from "lucide-react";'
);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully fixed admin layout import for GraduationCap!");
