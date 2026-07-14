import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1. Patch Admin Sidebar
const adminPath = join(__dirname, "../src/routes/_admin.tsx");
let adminContent = readFileSync(adminPath, "utf-8");

const oldAdminSidebarMap = `                  {items.map((it) => {
                    const active = it.exact ? path === it.to : path === it.to || path.startsWith(it.to + "/");
                    return (
                      <SidebarMenuItem key={it.to}>
                        <SidebarMenuButton asChild isActive={active}>
                          <Link to={it.to as any}><it.icon className="h-4 w-4" /><span>{it.label}</span></Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}`;

const newAdminSidebarMap = `                  {items.map((it) => {
                    let active = it.exact ? path === it.to : path === it.to || path.startsWith(it.to + "/");
                    if (it.to === "/admin/courses" && (path.startsWith("/admin/videos") || path.startsWith("/admin/modules"))) {
                      active = true;
                    }
                    return (
                      <SidebarMenuItem key={it.to}>
                        <SidebarMenuButton asChild isActive={active}>
                          <Link to={it.to as any}><it.icon className="h-4 w-4" /><span>{it.label}</span></Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}`;

adminContent = adminContent.replace(oldAdminSidebarMap, newAdminSidebarMap);
writeFileSync(adminPath, adminContent, "utf-8");
console.log("✅ Successfully patched admin sidebar highlighting!");

// 2. Patch Student Sidebar
const studentPath = join(__dirname, "../src/routes/_student.tsx");
let studentContent = readFileSync(studentPath, "utf-8");

const oldStudentSidebarMap = `                      {items.map((it) => (
                        <SidebarMenuItem key={it.to}>
                          <SidebarMenuButton asChild isActive={path === it.to || path.startsWith(it.to + "/")}>
                            <Link to={it.to}><it.icon className="h-4 w-4" /><span>{it.label}</span></Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}`;

const newStudentSidebarMap = `                      {items.map((it) => {
                        let active = path === it.to || path.startsWith(it.to + "/");
                        if (it.to === "/courses" && path.startsWith("/portal")) {
                          active = true;
                        }
                        return (
                          <SidebarMenuItem key={it.to}>
                            <SidebarMenuButton asChild isActive={active}>
                              <Link to={it.to}><it.icon className="h-4 w-4" /><span>{it.label}</span></Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}`;

studentContent = studentContent.replace(oldStudentSidebarMap, newStudentSidebarMap);

const oldStudentMobileMap = `              {[items[0], items[1], items[5], items[3], items[6]].map((it) => {
                const active = path === it.to || path.startsWith(it.to + "/");
                return (`;

const newStudentMobileMap = `              {[items[0], items[1], items[5], items[3], items[6]].map((it) => {
                let active = path === it.to || path.startsWith(it.to + "/");
                if (it.to === "/courses" && path.startsWith("/portal")) {
                  active = true;
                }
                return (`;

studentContent = studentContent.replace(oldStudentMobileMap, newStudentMobileMap);
writeFileSync(studentPath, studentContent, "utf-8");
console.log("✅ Successfully patched student sidebar highlighting!");
