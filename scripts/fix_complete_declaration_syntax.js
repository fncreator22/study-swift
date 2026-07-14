import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_student.portal.$courseId.complete.tsx");

let content = readFileSync(filePath, "utf-8");

// Search for the broken function block and replace with the correct one
const brokenBlock = `  async function submitDeclaration() {
    if (!enrollmentId) return;
    if (!checkbox1 || !checkbox2 || !checkbox3) {
      toast.error("Please confirm all three checkboxes to proceed.");
      return;
    }
      toast.error("Please confirm both checkboxes to proceed.");
      return;
    }
    setSubmitting(true);`;

const cleanBlock = `  async function submitDeclaration() {
    if (!enrollmentId) return;
    if (!checkbox1 || !checkbox2 || !checkbox3) {
      toast.error("Please confirm all three checkboxes to proceed.");
      return;
    }
    setSubmitting(true);`;

content = content.replace(brokenBlock, cleanBlock);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully fixed declaration function syntax error!");
