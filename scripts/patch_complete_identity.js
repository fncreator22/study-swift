import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_student.portal.$courseId.complete.tsx");

let content = readFileSync(filePath, "utf-8");

// 1. Declare state variables for email and certIssued
content = content.replace(
  `  const [nameInput, setNameInput] = useState("");
  const [dobInput, setDobInput] = useState("");`,
  `  const [nameInput, setNameInput] = useState("");
  const [dobInput, setDobInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [certIssued, setCertIssued] = useState(false);`
);

// 2. Fetch certificate and pre-fill email
const oldEffectLogic = `      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, date_of_birth")
        .eq("id", user.id)
        .maybeSingle();

      const locked = !!(profile?.full_name && profile?.date_of_birth);
      setIdentityLocked(locked);
      setProfileName(profile?.full_name ?? "");
      setNameInput(profile?.full_name ?? "");
      setDobInput(profile?.date_of_birth ?? "");`;

const newEffectLogic = `      // Check if a certificate already exists
      const { data: cert } = await supabase
        .from("course_certificates_v2" as any)
        .select("id")
        .eq("enrollment_id", enrollment.id)
        .maybeSingle();
      const hasCert = !!cert;
      setCertIssued(hasCert);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, date_of_birth")
        .eq("id", user.id)
        .maybeSingle();

      const locked = hasCert || !!(profile?.full_name && profile?.date_of_birth);
      setIdentityLocked(locked);
      setProfileName(profile?.full_name ?? "");
      setNameInput(profile?.full_name ?? "");
      setDobInput(profile?.date_of_birth ?? "");
      setEmailInput(user.email ?? "");`;

content = content.replace(oldEffectLogic, newEffectLogic);

// 3. Update confirmIdentity function to support email locking
const oldConfirm = `  async function confirmIdentity() {
    if (!user) return;
    const finalName = identityLocked ? profileName : nameInput.trim();
    const finalDob = identityLocked ? dobInput : dobInput.trim();
    if (!finalName || !finalDob) {
      toast.error("Please enter your full name and date of birth.");
      return;
    }
    setSubmitting(true);
    if (!identityLocked) {
      const { error } = await supabase.from("profiles").update({ full_name: finalName, date_of_birth: finalDob }).eq("id", user.id);
      if (error) { toast.error(error.message); setSubmitting(false); return; }
      setIdentityLocked(true);
      setProfileName(finalName);
    }
    setStep(3);
    setSubmitting(false);
  }`;

const newConfirm = `  async function confirmIdentity() {
    if (!user) return;
    const finalName = identityLocked ? profileName : nameInput.trim();
    const finalDob = identityLocked ? dobInput : dobInput.trim();
    if (!finalName || !finalDob || !emailInput.trim()) {
      toast.error("Please fill out all credentials to proceed.");
      return;
    }
    setSubmitting(true);
    if (!identityLocked) {
      const { error } = await supabase.from("profiles").update({ full_name: finalName, date_of_birth: finalDob }).eq("id", user.id);
      if (error) { toast.error(error.message); setSubmitting(false); return; }
      setIdentityLocked(true);
      setProfileName(finalName);
    }
    setStep(3);
    setSubmitting(false);
  }`;

content = content.replace(oldConfirm, newConfirm);

// 4. Update JSX in step 2 to render Full Name, Email, and DOB with locking support
const oldStep2View = `              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    Full Name (as on official ID)
                    {identityLocked && <Lock className="h-3.5 w-3.5 text-gray-400" />}
                  </Label>
                  <Input className="mt-1.5" placeholder="Your official full name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} disabled={identityLocked} />
                </div>
                <div>
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    Date of Birth
                    {identityLocked && <Lock className="h-3.5 w-3.5 text-gray-400" />}
                  </Label>
                  <Input className="mt-1.5" type="date" value={dobInput} onChange={(e) => setDobInput(e.target.value)} disabled={identityLocked} />
                </div>
              </div>`;

const newStep2View = `              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    Full Name (as on official ID)
                    {identityLocked && <Lock className="h-3.5 w-3.5 text-gray-400" />}
                  </Label>
                  <Input className="mt-1.5" placeholder="Your official full name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} disabled={identityLocked} />
                </div>
                <div>
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    Email Address
                    {identityLocked && <Lock className="h-3.5 w-3.5 text-gray-400" />}
                  </Label>
                  <Input className="mt-1.5" type="email" placeholder="Your email address" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} disabled={identityLocked} />
                </div>
                <div>
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    Date of Birth
                    {identityLocked && <Lock className="h-3.5 w-3.5 text-gray-400" />}
                  </Label>
                  <Input className="mt-1.5" type="date" value={dobInput} onChange={(e) => setDobInput(e.target.value)} disabled={identityLocked} />
                </div>
              </div>`;

content = content.replace(oldStep2View, newStep2View);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully updated Completion Gate step 2 identity fields!");
