import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1. Patch Admin Sidebar Tooltips
const adminPath = join(__dirname, "../src/routes/_admin.tsx");
let adminContent = readFileSync(adminPath, "utf-8");

adminContent = adminContent.replace(
  "<SidebarMenuButton asChild isActive={active}>",
  "<SidebarMenuButton asChild isActive={active} tooltip={it.label}>"
);
writeFileSync(adminPath, adminContent, "utf-8");
console.log("✅ Successfully added tooltips to admin sidebar buttons!");

// 2. Patch Student Sidebar Tooltips
const studentPath = join(__dirname, "../src/routes/_student.tsx");
let studentContent = readFileSync(studentPath, "utf-8");

studentContent = studentContent.replace(
  "<SidebarMenuButton asChild isActive={active}>",
  "<SidebarMenuButton asChild isActive={active} tooltip={it.label}>"
);
writeFileSync(studentPath, studentContent, "utf-8");
console.log("✅ Successfully added tooltips to student sidebar buttons!");
