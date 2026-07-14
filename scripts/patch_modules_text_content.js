import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_admin.admin.videos.$courseId.tsx");

let content = readFileSync(filePath, "utf-8");

// Fix ReferenceError: replace text_content with textContent in rowPayload definition
content = content.replace(
  'text_content: mode === "text" ? text_content : ""',
  'text_content: mode === "text" ? textContent : ""'
);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully patched modules text content ReferenceError!");
