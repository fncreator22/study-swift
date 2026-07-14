import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Share2 } from "lucide-react";
import { toast } from "sonner";

interface CertificateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  certificate: {
    id: string;
    course_title: string;
    recipient_name: string;
    date_of_birth: string | null;
    score: number;
    total: number;
    issued_at: string;
    certificate_code: string;
    instructor_name?: string;
  } | null;
}

// ── Inline SVG Barcode Generator ───────────────────────────────────────────
function AuthBarcode({ value }: { value: string }) {
  // Deterministic bar pattern from certificate hash
  const bars: { x: number; w: number }[] = [];
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
    hash = hash & 0x7fffffff;
  }
  let xPos = 0;
  for (let i = 0; i < 52; i++) {
    const byte = (hash >> (i % 28)) & 0xff;
    const w = (byte % 3) + 1;
    if (i % 2 === 0) bars.push({ x: xPos, w });
    xPos += w + 1;
  }
  const totalWidth = xPos;

  return (
    <div className="flex flex-col items-center gap-0.5 bg-white px-2 py-1.5 rounded border border-slate-100 select-none">
      <svg width={totalWidth} height="32" className="overflow-visible">
        {bars.map((b, i) => (
          <rect key={i} x={b.x} y={0} width={b.w} height={32} fill="#1a1a2e" />
        ))}
      </svg>
      <span className="text-[6px] font-mono tracking-[0.15em] text-slate-500 font-bold uppercase">
        AUTH: {value.substring(0, 20).toUpperCase()}
      </span>
    </div>
  );
}

// ── Official Gold Seal SVG ──────────────────────────────────────────────────
function GoldSeal({ size = 72 }: { size?: number }) {
  const r = size / 2;
  const pts = 18;
  // Generate starburst points for the seal edge
  const starPoints = Array.from({ length: pts * 2 }, (_, i) => {
    const angle = (i * Math.PI) / pts - Math.PI / 2;
    const radius = i % 2 === 0 ? r - 2 : r - 8;
    return `${r + radius * Math.cos(angle)},${r + radius * Math.sin(angle)}`;
  }).join(" ");

  return (
    <svg width={size} height={size} className="drop-shadow-md select-none">
      <defs>
        <radialGradient id="goldGrad" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#f9e784" />
          <stop offset="40%" stopColor="#d4af37" />
          <stop offset="100%" stopColor="#8b6914" />
        </radialGradient>
        <radialGradient id="innerGold" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fcf6ba" />
          <stop offset="60%" stopColor="#d4af37" />
          <stop offset="100%" stopColor="#aa771c" />
        </radialGradient>
      </defs>

      {/* Outer starburst */}
      <polygon points={starPoints} fill="url(#goldGrad)" />

      {/* Inner circle */}
      <circle cx={r} cy={r} r={r - 10} fill="url(#innerGold)" />
      <circle cx={r} cy={r} r={r - 13} fill="none" stroke="#8b6914" strokeWidth="0.5" />
      <circle cx={r} cy={r} r={r - 16} fill="none" stroke="#8b6914" strokeWidth="0.5" />

      {/* Text: EXAMLY */}
      <text x={r} y={r - 10} textAnchor="middle" fill="#3d2200" fontSize="7" fontWeight="900" fontFamily="sans-serif" letterSpacing="1.5" textDecoration="none" style={{ textTransform: "uppercase" }}>EXAMLY</text>
      {/* Text: LMS */}
      <text x={r} y={r - 1} textAnchor="middle" fill="#3d2200" fontSize="6" fontWeight="800" fontFamily="sans-serif" letterSpacing="1">LMS</text>
      {/* Divider */}
      <line x1={r - 12} y1={r + 2} x2={r + 12} y2={r + 2} stroke="#3d2200" strokeWidth="0.5" />
      {/* Text: OFFICIAL */}
      <text x={r} y={r + 10} textAnchor="middle" fill="#3d2200" fontSize="5.5" fontWeight="900" fontFamily="sans-serif" letterSpacing="1.2">OFFICIAL</text>
      {/* Text: VERIFIED */}
      <text x={r} y={r + 18} textAnchor="middle" fill="#3d2200" fontSize="5.5" fontWeight="900" fontFamily="sans-serif" letterSpacing="1.2">VERIFIED</text>
    </svg>
  );
}

// ── Corner Ornament SVG ────────────────────────────────────────────────────
function CornerOrnament({ flip = false }: { flip?: boolean }) {
  return (
    <svg width="40" height="40" className={`text-[#d4af37] ${flip ? "rotate-90" : ""}`} viewBox="0 0 40 40">
      <path d="M2 2 L18 2 L18 6 L6 6 L6 18 L2 18 Z" fill="none" stroke="#d4af37" strokeWidth="1.5" />
      <path d="M2 2 L2 10" stroke="#d4af37" strokeWidth="1" />
      <path d="M2 2 L10 2" stroke="#d4af37" strokeWidth="1" />
      <circle cx="18" cy="18" r="1.5" fill="#d4af37" />
    </svg>
  );
}

// ── Main Certificate Modal ─────────────────────────────────────────────────
export function CertificateModal({ open, onOpenChange, certificate }: CertificateModalProps) {
  if (!certificate) return null;

  const issueDateObj = new Date(certificate.issued_at);
  const awardDate = issueDateObj.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });

  // Calculate course duration window (60 days before completion)
  const startDateObj = new Date(issueDateObj.getTime() - 60 * 24 * 60 * 60 * 1000);
  const startDateStr = startDateObj.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const endDateStr = issueDateObj.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const verifyUrl = `${window.location.origin}/verify-certificate/${certificate.certificate_code}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(verifyUrl)}&bgcolor=ffffff&color=1e3a8a&margin=4`;
  const instructorName = certificate.instructor_name || "Maria Chen";
  const instructorTitle = "Director of Education, Examly";
  const certId = `EX-${certificate.certificate_code.substring(0, 8).toUpperCase()}-${issueDateObj.getFullYear()}`;

  const handlePrint = () => window.print();
  const handleShare = () => {
    navigator.clipboard.writeText(verifyUrl);
    toast.success("Verification link copied to clipboard!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] p-0 overflow-hidden bg-white border-0 shadow-2xl rounded-2xl print:shadow-none print:rounded-none">

        {/* ── Certificate Paper Area ── */}
        <div
          id="certificate-print-area"
          className="relative"
          style={{
            background: "linear-gradient(135deg, #fdfcf7 0%, #f9f5e8 50%, #fdfcf7 100%)",
            padding: "0",
            fontFamily: "Georgia, serif",
          }}
        >
          {/* Outer gold double border */}
          <div
            style={{
              margin: "16px",
              border: "6px double #d4af37",
              position: "relative",
              minHeight: "520px",
            }}
          >
            {/* Inner navy border */}
            <div
              style={{
                margin: "8px",
                border: "1.5px solid #1e3a8a",
                padding: "32px 48px 24px",
                minHeight: "492px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
              }}
            >
              {/* Corner ornaments */}
              <div style={{ position: "absolute", top: "8px", left: "8px" }}><CornerOrnament /></div>
              <div style={{ position: "absolute", top: "8px", right: "8px", transform: "rotate(90deg)" }}><CornerOrnament /></div>
              <div style={{ position: "absolute", bottom: "8px", left: "8px", transform: "rotate(-90deg)" }}><CornerOrnament /></div>
              <div style={{ position: "absolute", bottom: "8px", right: "8px", transform: "rotate(180deg)" }}><CornerOrnament /></div>

              {/* ── TOP: Examly Brand Header ── */}
              <div style={{ textAlign: "center", marginBottom: "8px" }}>
                <div style={{ fontFamily: "'Times New Roman', serif", fontSize: "32px", fontWeight: "900", color: "#1e3a8a", letterSpacing: "4px", textTransform: "uppercase" }}>
                  Examly
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "4px" }}>
                  <div style={{ height: "1px", width: "48px", background: "#d4af37" }} />
                  {/* LMS Badge with laurel */}
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "9px", color: "#8b6914" }}>❧</span>
                    <span style={{ fontSize: "9px", fontWeight: "900", letterSpacing: "4px", color: "#8b6914", textTransform: "uppercase" }}>LMS</span>
                    <span style={{ fontSize: "9px", color: "#8b6914" }}>❧</span>
                  </div>
                  <div style={{ height: "1px", width: "48px", background: "#d4af37" }} />
                </div>
              </div>

              {/* ── MIDDLE: Award Statement ── */}
              <div style={{ textAlign: "center", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "10px", padding: "8px 0" }}>
                <p style={{ fontStyle: "italic", fontSize: "13px", color: "#666", margin: 0 }}>
                  This <strong style={{ fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>Certificate</strong> is proudly awarded to
                </p>

                {/* Recipient name in blackletter/Gothic style */}
                <div style={{ margin: "4px 0" }}>
                  <p
                    style={{
                      fontFamily: "'UnifrakturMaguntia', 'MedievalSharp', 'IM Fell English', 'Palatino Linotype', Georgia, serif",
                      fontSize: "38px",
                      fontWeight: "700",
                      color: "#0f1a30",
                      letterSpacing: "2px",
                      margin: 0,
                      lineHeight: "1.1",
                      borderBottom: "1px solid #e2d5a0",
                      paddingBottom: "8px",
                      display: "inline-block",
                      minWidth: "300px",
                    }}
                  >
                    {certificate.recipient_name}
                  </p>
                </div>

                <p style={{ fontSize: "11px", color: "#777", margin: "2px 0", maxWidth: "400px", alignSelf: "center" }}>
                  in recognition of successfully completing the professional training course:
                </p>

                <div style={{ margin: "4px 0" }}>
                  <p style={{ fontFamily: "'Times New Roman', Georgia, serif", fontSize: "20px", fontWeight: "900", color: "#1e3a8a", margin: 0, lineHeight: "1.2", maxWidth: "500px", alignSelf: "center" }}>
                    {certificate.course_title}
                  </p>
                </div>

                <p style={{ fontSize: "11px", color: "#666", margin: "4px 0" }}>
                  Conducted through the Examly LMS platform from <strong>[{startDateStr}]</strong> to <strong>[{endDateStr}]</strong>
                </p>
                <p style={{ fontSize: "11px", color: "#555", fontWeight: "600", margin: 0 }}>
                  Awarded on this day: {awardDate}
                </p>
              </div>

              {/* ── BOTTOM: Signatures + QR + Seal ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", alignItems: "flex-end", gap: "16px", marginTop: "16px" }}>

                {/* CEO Signature */}
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontFamily: "'Great Vibes', 'Brush Script MT', cursive", fontSize: "28px", color: "#1e3a8a", margin: "0 0 4px 0", letterSpacing: "2px" }}>
                    James L. Albright
                  </p>
                  <div style={{ height: "1px", background: "#d4af37", marginBottom: "4px" }} />
                  <p style={{ fontSize: "9px", fontWeight: "700", color: "#1a1a2e", margin: 0, letterSpacing: "0.5px" }}>James L. Albright</p>
                  <p style={{ fontSize: "8px", color: "#888", margin: 0 }}>CEO & Co-Founder, Examly LMS</p>
                </div>

                {/* Center: QR Code */}
                <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "7px", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", color: "#999" }}>Scan to Verify</span>
                  <img
                    src={qrUrl}
                    alt="QR Verification Code"
                    width="64"
                    height="64"
                    style={{ border: "1px solid #e2d5a0", padding: "2px", background: "white" }}
                  />
                </div>

                {/* Instructor Signature + Gold Seal */}
                <div style={{ textAlign: "center", position: "relative" }}>
                  {/* Gold Seal positioned top-right of this column */}
                  <div style={{ position: "absolute", top: "-52px", right: "0px" }}>
                    <GoldSeal size={68} />
                  </div>

                  <p style={{ fontFamily: "'Great Vibes', 'Brush Script MT', cursive", fontSize: "28px", color: "#1e3a8a", margin: "0 0 4px 0", letterSpacing: "2px" }}>
                    {instructorName}
                  </p>
                  <div style={{ height: "1px", background: "#d4af37", marginBottom: "4px" }} />
                  <p style={{ fontSize: "9px", fontWeight: "700", color: "#1a1a2e", margin: 0, letterSpacing: "0.5px" }}>{instructorName}</p>
                  <p style={{ fontSize: "8px", color: "#888", margin: 0 }}>{instructorTitle}</p>
                </div>
              </div>

              {/* ── FOOTER: Barcode + Hash ── */}
              <div style={{ borderTop: "1px solid #e8dfc0", marginTop: "16px", paddingTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "7px", fontFamily: "monospace", color: "#aaa", margin: "0 0 3px 0" }}>
                    Verification Hash: {certificate.certificate_code}
                  </p>
                  <p style={{ fontSize: "7px", color: "#aaa", margin: 0 }}>
                    Verify Online at: <strong style={{ color: "#1e3a8a" }}>verify.examlylms.com</strong> &nbsp;|&nbsp; 
                    Examly Learning Management Systems &nbsp;|&nbsp; 
                    Certificate ID: <strong>{certId}</strong> &nbsp;|&nbsp; 
                    Issued by: Examly LMS &nbsp;|&nbsp; Non-Transferable
                  </p>
                </div>
                <AuthBarcode value={certificate.certificate_code} />
              </div>

            </div>
          </div>
        </div>

        {/* ── Action Controls (hidden in print) ── */}
        <div className="flex items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50 print:hidden">
          <p className="text-xs text-muted-foreground italic">
            💡 Enable "Background Graphics" in print settings for best results. Use Landscape orientation.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" /> Copy Link
            </Button>
            <Button size="sm" onClick={handlePrint} className="bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white font-bold gap-2">
              <Printer className="h-4 w-4" /> Print / Save PDF
            </Button>
          </div>
        </div>

        {/* ── Print CSS ── */}
        <style dangerouslySetInnerHTML={{ __html: `
          @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=UnifrakturMaguntia&display=swap');
          @media print {
            body > * { display: none !important; }
            body > [data-radix-portal] { display: block !important; }
            [data-radix-portal] > * { display: none !important; }
            [data-radix-portal] [role="dialog"] {
              display: block !important;
              position: fixed !important;
              inset: 0 !important;
              max-width: none !important;
              max-height: none !important;
              border-radius: 0 !important;
              border: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
            }
            #certificate-print-area {
              width: 100% !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print\\:hidden { display: none !important; }
            @page { size: landscape; margin: 0; }
          }
        `}} />
      </DialogContent>
    </Dialog>
  );
}
