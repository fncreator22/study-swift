import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_student.portal.$courseId.tsx");

let content = readFileSync(filePath, "utf-8");

const oldBanner = `<p className="font-bold text-sm">dYZ% Course Complete!</p>
            <p className="text-xs opacity-90">
              Ready to get certified? Complete your feedback and take the final assessment.
            </p>`;

const newBanner = `<p className="font-bold text-sm">🎉 Course Complete!</p>
            <p className="text-xs opacity-90">
              Ready to get certified? You must complete a feedback form, confirm your credentials, and then pass the final Course Assessment test based on which you will receive your certificate.
            </p>`;

// Direct string replacement (making it bulletproof by just changing the text inside)
content = content.replace(
  "Ready to get certified? Complete your feedback and take the final assessment.",
  "Ready to get certified? You must complete a feedback form, confirm your credentials, and then pass the final Course Assessment test based on which you will receive your certificate."
);

content = content.replace("dYZ% Course Complete!", "🎉 Course Complete!");

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully patched portal completion banner text!");
