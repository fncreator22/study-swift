import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1. Patch courses.index page
const indexPage = join(__dirname, "../src/routes/_student.courses.index.tsx");
let contentIndex = readFileSync(indexPage, "utf-8");
contentIndex = contentIndex.replace(
  '{(c.avg_rating ?? 0) > 0 ? c.avg_rating.toFixed(1) : "4.9"}',
  'Number(c.avg_rating || 0).toFixed(1)'
);
writeFileSync(indexPage, contentIndex, "utf-8");
console.log("✅ Successfully patched marketplace to show actual ratings!");

// 2. Patch course details page
const detailsPage = join(__dirname, "../src/routes/_student.courses.$courseId.tsx");
let contentDetails = readFileSync(detailsPage, "utf-8");
contentDetails = contentDetails.replace(
  'const avgRating = course?.avg_rating ?? 4.8;',
  'const avgRating = Number(course?.avg_rating || 0);'
);
writeFileSync(detailsPage, contentDetails, "utf-8");
console.log("✅ Successfully patched course details page to show actual ratings!");
