import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_student.portal.$courseId.complete.tsx");

let content = readFileSync(filePath, "utf-8");

content = content.replace("overall_rating: overallRating", "satisfaction_score: overallRating");
content = content.replace("platform_rating: platformRating", "usability_rating: platformRating");
content = content.replace("suggestions: suggestions || null", "improvements: suggestions || null");

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully patched completion gate feedback mapping!");
