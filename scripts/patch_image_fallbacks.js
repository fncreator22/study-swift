import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1. Patch src/routes/_admin.admin.courses.tsx
const adminPagePath = join(__dirname, "../src/routes/_admin.admin.courses.tsx");
let adminContent = readFileSync(adminPagePath, "utf-8");

// Insert imgErrors state at the top of AdminCourses
adminContent = adminContent.replace(
  "  const [editing, setEditing] = useState<string | null>(null);",
  "  const [editing, setEditing] = useState<string | null>(null);\n  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});"
);

// Replace card image rendering
const oldAdminImg = `{c.thumbnail_url ? <img src={c.thumbnail_url} alt={c.title} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-primary/5 text-primary/20"><PlayCircle className="h-10 w-10" /></div>}`;

const newAdminImg = `{c.thumbnail_url && !imgErrors[c.id] ? (
                <img 
                  src={c.thumbnail_url} 
                  alt={c.title} 
                  className="h-full w-full object-cover" 
                  onError={() => setImgErrors(prev => ({ ...prev, [c.id]: true }))}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-primary/5 text-muted-foreground/60 p-3 text-center gap-1.5">
                  <PlayCircle className="h-8 w-8 text-muted-foreground/35" />
                  <span className="text-[9px] font-black uppercase tracking-wider">Preview Unavailable</span>
                </div>
              )}`;

adminContent = adminContent.replace(oldAdminImg, newAdminImg);
writeFileSync(adminPagePath, adminContent, "utf-8");
console.log("✅ Patched image fallback handling in admin courses page!");

// 2. Patch src/routes/_student.courses.index.tsx
const studentIndexPagePath = join(__dirname, "../src/routes/_student.courses.index.tsx");
let studentIndexContent = readFileSync(studentIndexPagePath, "utf-8");

studentIndexContent = studentIndexContent.replace(
  "  const [selectedPlanId, setSelectedPlanId] = useState<string>(\"none\");",
  "  const [selectedPlanId, setSelectedPlanId] = useState<string>(\"none\");\n  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});"
);

const oldStudentIndexImg = `                  {c.thumbnail_url ? (
                    <img
                      src={c.thumbnail_url}
                      alt={c.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className={\`flex h-full w-full items-center justify-center bg-gradient-to-br \${gradient}\`}
                    >
                      <PlayCircle className="h-12 w-12 text-white/30" />
                    </div>
                  )}`;

const newStudentIndexImg = `                  {c.thumbnail_url && !imgErrors[c.id] ? (
                    <img
                      src={c.thumbnail_url}
                      alt={c.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={() => setImgErrors(prev => ({ ...prev, [c.id]: true }))}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-primary/5 text-muted-foreground/60 p-3 text-center gap-1.5">
                      <PlayCircle className="h-8 w-8 text-muted-foreground/35" />
                      <span className="text-[9px] font-black uppercase tracking-wider">Preview Unavailable</span>
                    </div>
                  )}`;

studentIndexContent = studentIndexContent.replace(oldStudentIndexImg, newStudentIndexImg);
writeFileSync(studentIndexPagePath, studentIndexContent, "utf-8");
console.log("✅ Patched image fallback handling in student marketplace page!");

// 3. Patch src/routes/_student.courses.$courseId.tsx
const studentDetailsPagePath = join(__dirname, "../src/routes/_student.courses.$courseId.tsx");
let studentDetailsContent = readFileSync(studentDetailsPagePath, "utf-8");

studentDetailsContent = studentDetailsContent.replace(
  "  const [enrolling, setEnrolling] = useState(false);",
  "  const [enrolling, setEnrolling] = useState(false);\n  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});"
);

// Replace hero banner thumbnail
const oldDetailsHeroImg = `        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a8a] via-[#1e40af] to-[#3730a3]" />
        )}`;

const newDetailsHeroImg = `        {course.thumbnail_url && !imgErrors['hero'] ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setImgErrors(prev => ({ ...prev, hero: true }))}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a8a] via-[#1e40af] to-[#3730a3] flex flex-col items-center justify-center text-center p-6 gap-2">
            <PlayCircle className="h-16 w-16 text-white/20 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Preview Banner Unavailable</span>
          </div>
        )}`;

studentDetailsContent = studentDetailsContent.replace(oldDetailsHeroImg, newDetailsHeroImg);

// Replace sticky panel thumbnail
const oldDetailsStickyImg = `              {course.thumbnail_url ? (
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="w-full aspect-video object-cover"
                />
              ) : (
                <div className="w-full aspect-video bg-gradient-to-br from-[#1e3a8a] via-[#1e40af] to-[#3730a3] flex items-center justify-center">
                  <BookOpen className="h-16 w-16 text-white/20" />
                </div>
              )}`;

const newDetailsStickyImg = `              {course.thumbnail_url && !imgErrors['sticky'] ? (
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="w-full aspect-video object-cover"
                  onError={() => setImgErrors(prev => ({ ...prev, sticky: true }))}
                />
              ) : (
                <div className="w-full aspect-video bg-primary/5 flex flex-col items-center justify-center text-center p-4 gap-2">
                  <PlayCircle className="h-10 w-10 text-muted-foreground/35" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Preview Unavailable</span>
                </div>
              )}`;

studentDetailsContent = studentDetailsContent.replace(oldDetailsStickyImg, newDetailsStickyImg);
writeFileSync(studentDetailsPagePath, studentDetailsContent, "utf-8");
console.log("✅ Patched image fallback handling in student details page!");
