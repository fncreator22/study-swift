import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_student.portal.$courseId.index.tsx");

let content = readFileSync(filePath, "utf-8");

// Use a regular expression to locate the Link tag enclosing "Get Certified"
const linkRegex = /<Link to="\/portal\/\$courseId\/complete" params=\{\{\s*courseId\s*\}\}>\s*<Button className="bg-white text-emerald-700 hover:bg-white\/90 font-bold text-xs h-8 px-3 rounded-xl shrink-0">[\s\S]*?<\/Button>\s*<\/Link>/;

if (linkRegex.test(content)) {
  content = content.replace(
    linkRegex,
    `<Button 
            className="bg-white text-emerald-700 hover:bg-white/90 font-bold text-xs h-8 px-3 rounded-xl shrink-0"
            onClick={() => navigate({ to: "/portal/$courseId/complete", params: { courseId } })}
          >
            Start Certification →
          </Button>`
  );
  writeFileSync(filePath, content, "utf-8");
  console.log("✅ Successfully patched player complete button using regex!");
} else {
  console.error("❌ Failed to match the Link block using regex!");
}
