import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_admin.admin.courses.tsx");

let content = readFileSync(filePath, "utf-8");

// Add ShieldAlert to import from lucide-react
content = content.replace(
  'import { Plus, PlayCircle, Film, Pencil, Trash2, Trophy, Clock, FileText, CheckCircle } from "lucide-react";',
  'import { Plus, PlayCircle, Film, Pencil, Trash2, Trophy, Clock, FileText, CheckCircle, ShieldAlert } from "lucide-react";'
);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully patched ShieldAlert import in admin courses!");
