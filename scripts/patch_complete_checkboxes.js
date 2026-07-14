import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_student.portal.$courseId.complete.tsx");

let content = readFileSync(filePath, "utf-8");

// 1. Add checkbox3 state
content = content.replace(
  "  const [checkbox2, setCheckbox2] = useState(false);",
  "  const [checkbox2, setCheckbox2] = useState(false);\n  const [checkbox3, setCheckbox3] = useState(false);"
);

// 2. Update submitDeclaration checking logic
content = content.replace(
  "    if (!checkbox1 || !checkbox2) {",
  "    if (!checkbox1 || !checkbox2 || !checkbox3) {\n      toast.error(\"Please confirm all three checkboxes to proceed.\");\n      return;\n    }"
);

// 3. Update the checklist UI in Step 3
const oldChecklistUi = `              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" checked={checkbox1} onChange={(e) => setCheckbox1(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    I confirm my name and date of birth are authentic and accurate.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" checked={checkbox2} onChange={(e) => setCheckbox2(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    I accept the certification terms and conditions and the academic integrity policy.
                  </span>
                </label>
              </div>`;

const newChecklistUi = `              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" checked={checkbox1} onChange={(e) => setCheckbox1(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    I confirm my name and date of birth are authentic and accurate.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" checked={checkbox2} onChange={(e) => setCheckbox2(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    I accept the certification terms and conditions and the academic integrity policy.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" checked={checkbox3} onChange={(e) => setCheckbox3(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    I agree to follow the exam instructions, will not cheat or use unauthorized aids, and understand that violation is punishable under academic policy.
                  </span>
                </label>
              </div>`;

content = content.replace(oldChecklistUi, newChecklistUi);

// 4. Update the submit button disabled state and label
content = content.replace(
  "disabled={submitting || !checkbox1 || !checkbox2}",
  "disabled={submitting || !checkbox1 || !checkbox2 || !checkbox3}"
);

content = content.replace(
  "Proceed to Assessment &rarr;",
  "Start the Test →"
);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully patched completion gate declaration checkboxes and button label!");
