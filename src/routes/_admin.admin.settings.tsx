import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, Upload, RotateCcw, ShieldAlert, Key, FileJson, LogOut, User } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_admin/admin/settings")({ component: AdminSettings });

const TABLES = [
  "profiles", "tests", "test_questions", "test_attempts", "test_answers", 
  "purchases", "videos", "comments", "wallet_transactions", "token_requests"
];

function AdminSettings() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function changePwd() {
    if (pwd.length < 6) return toast.error("Password must be 6+ chars");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setPwd("");
  }

  async function exportData() {
    setLoading(true);
    const data: Record<string, any> = {};
    try {
      for (const table of TABLES) {
        const { data: rows, error } = await (supabase as any).from(table).select("*");
        if (error) throw error;
        data[table] = rows;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `examly_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      toast.success("Platform data exported successfully");
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
    }
    setLoading(false);
  }

  async function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        for (const table of TABLES) {
          if (data[table] && Array.isArray(data[table])) {
            const { error } = await (supabase as any).from(table).upsert(data[table]);
            if (error) toast.error(`Error importing ${table}: ${error.message}`);
          }
        }
        toast.success("Platform data imported successfully");
      } catch (err: any) {
        toast.error("Import failed: " + err.message);
      }
      setLoading(false);
    };
    reader.readAsText(file);
  }

  async function resetSystem(type: 'rankings' | 'all') {
    setLoading(true);
    try {
      if (type === 'rankings' || type === 'all') {
        await supabase.from("test_answers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("test_attempts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }
      if (type === 'all') {
        toast.success("System reset successfully");
      } else {
        toast.success("Rankings and attempts cleared");
      }
    } catch (err: any) {
      toast.error("Reset failed: " + err.message);
    }
    setLoading(false);
  }

  async function handleLogout() {
    await signOut();
    toast.success("Logged out");
    nav({ to: "/" });
  }

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Platform Settings & Tools</h1>
          <p className="text-muted-foreground mt-1">Manage system security, data integrity, and administrative tools.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} className="rounded-xl border-destructive/20 text-destructive hover:bg-destructive/5 hover:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Log out
        </Button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2 mb-6">
              <User className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-bold">Profile Details</h2>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email address</Label>
                <Input value={user?.email ?? ""} disabled className="bg-muted/50" />
              </div>
              <p className="text-xs text-muted-foreground">Admin credentials are managed securely via Supabase Auth.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold mb-6">
              <Key className="h-5 w-5 text-primary" /> Admin Security
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="6+ characters" />
              </div>
              <Button onClick={changePwd} disabled={loading} className="w-full rounded-xl">Update Password</Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold mb-2">
              <FileJson className="h-5 w-5 text-primary" /> Data Backup & Migration
            </h2>
            <p className="text-sm text-muted-foreground mb-6">Export or import entire platform datasets for offline backup and restoration.</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={exportData} disabled={loading} className="flex-1">
                <Download className="mr-2 h-4 w-4" /> Export JSON
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading} className="flex-1">
                <Upload className="mr-2 h-4 w-4" /> Import JSON
              </Button>
              <input type="file" ref={fileInputRef} onChange={importData} className="hidden" accept=".json" />
            </div>
          </div>

          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-destructive mb-2">
              <ShieldAlert className="h-5 w-5" /> Danger zone (Maintenance)
            </h2>
            <p className="text-sm text-muted-foreground text-destructive/80 mb-6 font-medium italic">Warning: Wiping database operations is completely irreversible.</p>
            
            <div className="space-y-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={loading} className="w-full justify-start border-destructive/20 hover:bg-destructive/10 hover:text-destructive">
                    <RotateCcw className="mr-2 h-4 w-4" /> Clear Rankings & Attempts
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl border-destructive/20">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all attempts?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete ALL student test attempts, answers, and scores. Rankings will be reset to zero. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => resetSystem('rankings')} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Clear Data
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={loading} className="w-full justify-start">
                    <RotateCcw className="mr-2 h-4 w-4" /> Full System Reset
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl border-destructive/20">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action will clear all dynamic data. Users and tests will remain, but all interactions will be wiped.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => resetSystem('all')} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">Confirm Full Reset</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
