import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_admin.admin.courses.tsx");

let content = readFileSync(filePath, "utf-8");

// Rename referenceAnswer state to writtenReference
content = content.replace(
  'const [referenceAnswer, setReferenceAnswer] = useState("");',
  'const [writtenReference, setWrittenReference] = useState("");'
);

// Rename requiredKeywords state to writtenKeywords
content = content.replace(
  'const [requiredKeywords, setRequiredKeywords] = useState("");',
  'const [writtenKeywords, setWrittenKeywords] = useState("");'
);

// Replace setRequiredKeywords calls with setWrittenKeywords
content = content.replaceAll("setRequiredKeywords(", "setWrittenKeywords(");
content = content.replaceAll("requiredKeywords", "writtenKeywords");

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully aligned and fixed assessment modal state variables!");
