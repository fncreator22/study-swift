import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_student.portal.$courseId.index.tsx");

let content = readFileSync(filePath, "utf-8");

// 1. Remove the top-bar complete button (lines 484-494 approx)
const oldTopButton = `          {progressPercent >= 95 && (
            <Link to="/portal/$courseId/complete" params={{ courseId }}>
              <Button
                size="sm"
                className="h-7 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1.5"
              >
                <Trophy className="h-3.5 w-3.5" />
                Complete Course
              </Button>
            </Link>
          )}`;

content = content.replace(oldTopButton, "");

// 2. Replace the banner Link with programmatic button navigate
const oldBannerLink = `          <Link to="/portal/$courseId/complete" params={{ courseId }}>
            <Button className="bg-white text-emerald-700 hover:bg-white/90 font-bold text-xs h-8 px-3 rounded-xl shrink-0">
              Get Certified +'
            </Button>
          </Link>`;

const newBannerButton = `          <Button 
            className="bg-white text-emerald-700 hover:bg-white/90 font-bold text-xs h-8 px-3 rounded-xl shrink-0"
            onClick={() => navigate({ to: "/portal/$courseId/complete", params: { courseId } })}
          >
            Start Certification →
          </Button>`;

content = content.replace(oldBannerLink, newBannerButton);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully patched player completion banner button to use navigate()!");
