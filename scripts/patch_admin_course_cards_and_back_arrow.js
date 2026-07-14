import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_admin.admin.courses.tsx");

let content = readFileSync(filePath, "utf-8");

// 1. Add ArrowLeft import from lucide-react
content = content.replace(
  'import { Plus, PlayCircle, Film, Pencil, Trash2, Trophy, Clock, FileText, CheckCircle, ShieldAlert } from "lucide-react";',
  'import { Plus, PlayCircle, Film, Pencil, Trash2, Trophy, Clock, FileText, CheckCircle, ShieldAlert, ArrowLeft } from "lucide-react";'
);

// 2. Stack the course card buttons into two neat rows (lines 380-395 approx)
const oldButtonsLayout = `              <div className="flex gap-2 pt-2 border-t border-border/50">
                <Link to="/admin/videos/$courseId" params={{ courseId: c.id }} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full rounded-xl text-xs font-bold">
                    <Film className="h-3.5 w-3.5 mr-1" /> Modules
                  </Button>
                </Link>
                <Button size="sm" variant="outline" onClick={() => openAssessmentSettings(c)} className="flex-1 rounded-xl text-xs font-bold">
                  <Trophy className="h-3.5 w-3.5 mr-1 text-amber-500" /> Assessment
                </Button>
                <Button size="sm" variant="ghost" onClick={() => startEdit(c)} className="rounded-xl px-2.5"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(c.id)} className="rounded-xl px-2.5 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>`;

const newButtonsLayout = `              <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
                <div className="flex gap-2">
                  <Link to="/admin/videos/$courseId" params={{ courseId: c.id }} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full rounded-xl text-xs font-bold h-9">
                      <Film className="h-3.5 w-3.5 mr-1.5 text-blue-500" /> Modules
                    </Button>
                  </Link>
                  <Button size="sm" variant="outline" onClick={() => openAssessmentSettings(c)} className="flex-1 rounded-xl text-xs font-bold h-9">
                    <Trophy className="h-3.5 w-3.5 mr-1.5 text-amber-500" /> Assessment
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(c)} className="flex-1 rounded-xl text-xs font-bold h-9 gap-1">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Edit Info
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => remove(c.id)} className="rounded-xl px-3 text-destructive hover:bg-destructive/10 h-9 gap-1">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>`;

content = content.replace(oldButtonsLayout, newButtonsLayout);

// 3. Add Back Arrow button next to "Modify Question" header
const oldFormHeader = `                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                    {activeQuestionId ? "Modify Question" : "Create New Question"}
                  </h4>`;

const newFormHeader = `                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                      {activeQuestionId && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 p-0 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800" 
                          onClick={resetQuestionForm}
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {activeQuestionId ? "Modify Question" : "Create New Question"}
                    </h4>
                    {activeQuestionId && (
                      <span className="text-[9px] bg-amber-500/10 text-amber-500 font-bold px-2 py-0.5 rounded-full">
                        Editing Mode
                      </span>
                    )}
                  </div>`;

content = content.replace(oldFormHeader, newFormHeader);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully patched course cards buttons & question back arrow!");
