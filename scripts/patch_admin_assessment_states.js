import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_admin.admin.courses.tsx");

let content = readFileSync(filePath, "utf-8");

// Insert the missing state hooks: passingScore, timeLimit
content = content.replace(
  "  const [savingAssessment, setSavingAssessment] = useState(false);",
  "  const [savingAssessment, setSavingAssessment] = useState(false);\n  const [passingScore, setPassingScore] = useState(\"80\");\n  const [timeLimit, setTimeLimit] = useState(\"60\");"
);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully patched missing assessment states (passingScore, timeLimit)!");
