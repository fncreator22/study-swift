import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_student.dashboard.tsx");

let content = readFileSync(filePath, "utf-8");

// 1. Slice enrolledCourses array to show maximum 6 elements in dashboard
content = content.replace(
  "setEnrolledCourses(mappedEnrolled);",
  "setEnrolledCourses(mappedEnrolled.slice(0, 6));"
);

// 2. Add "View All" link next to "My Learning (Enrolled Courses)" header
const oldHeader = `           {enrolledCourses.length > 0 && (
             <div className="mb-8">
               <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">My Learning (Enrolled Courses)</h3>`;

const newHeader = `           {enrolledCourses.length > 0 && (
             <div className="mb-8">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">My Learning (Enrolled Courses)</h3>
                 <Link to="/purchased" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                   View All <ChevronRight className="h-3 w-3" />
                 </Link>
               </div>`;

content = content.replace(oldHeader, newHeader);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully limited dashboard enrolled courses to latest 6 with 'View All' link!");
