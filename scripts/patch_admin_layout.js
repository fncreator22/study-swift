import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_admin.tsx");

let content = readFileSync(filePath, "utf-8");

// Add import GraduationCap from lucide-react if not present, and update nav list
content = content.replace(
  'import { LayoutDashboard, Users, BookOpen, FileText, PlayCircle, Coins, Crown, ShieldAlert, BarChart3, Sparkles, Bell, MessageSquare, Settings, LogOut } from "lucide-react";',
  'import { LayoutDashboard, Users, BookOpen, FileText, PlayCircle, Coins, Crown, ShieldAlert, BarChart3, Sparkles, Bell, MessageSquare, Settings, LogOut, GraduationCap } from "lucide-react";'
);

content = content.replace(
  '{ to: "/admin/reviews", label: "Review Tests", icon: FileText },',
  '{ to: "/admin/reviews", label: "Review Tests", icon: FileText },\n  { to: "/admin/course-reviews", label: "Course Reviews", icon: GraduationCap },'
);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully patched Admin layout menu!");
