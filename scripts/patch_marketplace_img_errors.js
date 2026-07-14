import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_student.courses.index.tsx");

let content = readFileSync(filePath, "utf-8");

// Insert the missing imgErrors state declaration
content = content.replace(
  "function Courses() {\n  const { user } = useAuth();",
  "function Courses() {\n  const { user } = useAuth();\n  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});"
);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully patched marketplace imgErrors declaration!");
