import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Share2, Award, CheckCircle } from "lucide-react";
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
  } | null;
}

export function CertificateModal({ open, onOpenChange, certificate }: CertificateModalProps) {
  if (!certificate) return null;

  const issueDate = new Date(certificate.issued_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/verify-certificate/${certificate.certificate_code}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Certificate verification link copied to clipboard!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[850px] p-0 overflow-hidden bg-white border-0 shadow-2xl rounded-2xl print:shadow-none print:rounded-none">
        
        {/* Certificate Landscape Layout (Coursera Replica) */}
        <div 
          id="certificate-print-area"
          className="relative grid grid-cols-12 bg-white text-slate-800 font-sans p-12 border-[1px] border-slate-300 print:p-8 print:border-0"
          style={{ minHeight: "600px", aspectRatio: "1.414 / 1" }}
        >
          {/* Subtle Guilloche Watermark Pattern */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none bg-[radial-gradient(circle_at_center,_#000000_1px,_transparent_1px)] bg-[size:16px_16px]"></div>

          {/* Left Column (Main Certification Info) - col-span-8 */}
          <div className="col-span-8 flex flex-col justify-between pr-8 z-10">
            
            {/* Top: Institution/Authorized Partner Brand Logo */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-900 text-amber-500 font-bold text-lg">
                E
              </div>
              <div className="flex flex-col text-left">
                <span className="font-display text-sm font-black tracking-widest text-slate-900">EXAMLY ACADEMY</span>
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold">Authorized Certification</span>
              </div>
            </div>

            {/* Middle: Certificate Credentials */}
            <div className="space-y-6 text-left my-auto py-8">
              <div>
                <p className="text-[11px] font-mono text-slate-500">{issueDate}</p>
              </div>

              <div className="space-y-1">
                <h2 className="font-serif text-3xl font-bold tracking-tight text-slate-900">
                  {certificate.recipient_name}
                </h2>
                <p className="text-xs text-slate-500 italic">has successfully completed</p>
              </div>

              <div className="space-y-2">
                <h3 className="font-serif text-2xl font-black text-[#1e293b] leading-tight">
                  {certificate.course_title}
                </h3>
                <p className="text-[11px] text-slate-500 max-w-md">
                  an online non-credit course authorized by Examly Academy and offered through Examly's learning platform
                </p>
              </div>
            </div>

            {/* Bottom: Signature Area */}
            <div className="flex items-end justify-between">
              <div className="text-left">
                {/* Simulated Cursive Signature */}
                <p className="font-serif italic text-2xl font-bold text-slate-800 tracking-wide select-none" style={{ fontFamily: "'Brush Script MT', cursive, sans-serif" }}>
                  Jules White
                </p>
                <div className="w-48 h-px bg-slate-300 my-1"></div>
                <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Dr. Jules White</p>
                <p className="text-[8px] text-slate-400">Dean of Computer Science, Examly Academy</p>
              </div>
            </div>

          </div>

          {/* Right Column (Verification Ribbon & Stamp) - col-span-4 */}
          <div className="col-span-4 flex flex-col justify-between border-l border-slate-100 pl-8 relative z-10 bg-slate-50/50 p-4 rounded-r-xl print:bg-white print:border-0">
            
            {/* The Coursera-style Hanging Ribbon */}
            <div className="absolute top-0 right-6 w-24 h-64 bg-slate-200/80 shadow-sm flex flex-col items-center justify-between pb-6 rounded-b-md print:bg-slate-100">
              <div className="w-full bg-slate-300/50 h-2"></div>
              {/* Vertical Ribbon Text */}
              <span className="text-[9px] font-sans font-black tracking-[0.35em] text-slate-500 uppercase select-none [writing-mode:vertical-lr] my-auto">
                COURSE CERTIFICATE
              </span>
              
              {/* Double Ring Official Stamp */}
              <div className="w-16 h-16 rounded-full border-4 border-double border-slate-400 bg-white flex items-center justify-center shadow-sm">
                <div className="absolute w-12 h-12 rounded-full border border-dashed border-slate-400 flex flex-col items-center justify-center text-[7px] font-black text-slate-400 tracking-tighter scale-90">
                  <span>VERIFIED</span>
                  <span className="font-bold text-slate-600 font-sans">examly</span>
                  <span>CREDENTIAL</span>
                </div>
              </div>
            </div>

            {/* Bottom-right: Verification links */}
            <div className="mt-auto text-left space-y-3 pt-64">
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Verify at:</p>
                <a 
                  href={`${window.location.origin}/verify-certificate/${certificate.certificate_code}`}
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-[10px] text-blue-600 hover:underline font-mono break-all font-semibold"
                >
                  {window.location.host}/verify/{certificate.certificate_code}
                </a>
              </div>
              <p className="text-[9px] text-slate-400 leading-normal">
                Examly has confirmed the identity of this individual and their participation in the course.
              </p>
            </div>

          </div>

          {/* Footer Legal/Disclaimer Banner (Full Width) */}
          <div className="col-span-12 border-t border-slate-200 mt-8 pt-4 text-center z-10">
            <p className="text-[8px] text-slate-400 leading-normal max-w-2xl mx-auto">
              This certificate attests to the learner's completion of an online course / training module delivered via Examly. It does not constitute formal academic enrollment at any university or entity and does not itself grant academic credit, grades, or a degree.
            </p>
          </div>

        </div>

        {/* Certificate Modal Control Buttons (Hidden during Print) */}
        <div className="flex items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50 print:hidden">
          <p className="text-xs text-muted-foreground italic">
            Tip: Choose "Landscape" layout in the print settings to save/print properly.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" /> Copy Share Link
            </Button>
            <Button size="sm" onClick={handlePrint} className="bg-slate-900 hover:bg-slate-800 text-white font-bold">
              <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
            </Button>
          </div>
        </div>

        {/* Dynamic Landscape Printing Styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            #certificate-print-area, #certificate-print-area * {
              visibility: visible;
            }
            #certificate-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              height: 100%;
              border: 0 !important;
              background-color: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            @page {
              size: landscape;
              margin: 0;
            }
          }
        `}} />

      </DialogContent>
    </Dialog>
  );
}
