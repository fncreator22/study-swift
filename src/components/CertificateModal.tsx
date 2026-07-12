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
        
        {/* Certificate Landscape Layout (Coursera Double-Border Luxury Replica) */}
        <div 
          id="certificate-print-area"
          className="relative bg-[#fafaf9] p-5 text-slate-800 font-sans border border-slate-300 print:p-0 print:border-0"
          style={{ minHeight: "580px", aspectRatio: "1.414 / 1" }}
        >
          {/* Inner border line (spaced from outer border by 20px padding) */}
          <div className="relative w-full h-full border border-slate-300/70 bg-white p-12 grid grid-cols-12 z-10 box-border">
            
            {/* Subtle Guilloche/Grid Watermark Pattern */}
            <div className="absolute inset-0 opacity-[0.025] pointer-events-none select-none bg-[radial-gradient(circle_at_center,_#000000_1px,_transparent_1px)] bg-[size:18px_18px]"></div>

            {/* Left Column (Main Certification Info) - col-span-8 */}
            <div className="col-span-8 flex flex-col justify-between pr-4 z-10 text-left">
              
              {/* Top: Institution/Authorized Partner Brand Logo */}
              <div className="flex items-center gap-4">
                {/* Gold Crest Monogram Logo Accent */}
                <div className="flex items-center justify-center w-12 h-12 rounded bg-slate-900 border-b-2 border-amber-500 text-amber-500 font-serif font-black text-2xl shadow-sm">
                  V
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-xs font-black tracking-[0.25em] text-slate-900">EXAMLY UNIVERSITY</span>
                  <span className="text-[7.5px] uppercase tracking-wider text-slate-400 font-bold">Authorized learning partner</span>
                </div>
              </div>

              {/* Middle: Certificate Credentials */}
              <div className="space-y-6 my-auto py-8">
                <div>
                  <p className="text-[10px] font-mono text-slate-400 font-semibold">{issueDate}</p>
                </div>

                <div className="space-y-2">
                  <h2 className="font-serif text-3xl font-normal text-slate-900 leading-none">
                    {certificate.recipient_name}
                  </h2>
                  <p className="text-[11px] text-slate-500 italic font-medium leading-none">has successfully completed</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-serif text-2xl font-bold text-slate-900 leading-snug tracking-tight">
                    {certificate.course_title}
                  </h3>
                  <p className="text-[10px] text-slate-500 max-w-md leading-relaxed">
                    an online non-credit course authorized by Examly University and offered through Examly's learning platform
                  </p>
                </div>
              </div>

              {/* Bottom: Signature Area */}
              <div className="flex items-end justify-between">
                <div>
                  {/* Simulated Cursive Signature */}
                  <p className="font-serif italic text-2xl font-medium text-slate-800 tracking-wide select-none" style={{ fontFamily: "'Brush Script MT', cursive, sans-serif" }}>
                    Jules White
                  </p>
                  <div className="w-48 h-[0.5px] bg-slate-300 my-1"></div>
                  <p className="text-[8.5px] uppercase font-bold text-slate-400 tracking-wider">Dr. Jules White</p>
                  <p className="text-[7.5px] text-slate-400 font-medium">Dean of Computer Science, Examly Academy</p>
                </div>
              </div>

            </div>

            {/* Right Column (Verification Ribbon & Stamp) - col-span-4 */}
            <div className="col-span-4 flex flex-col justify-between border-l border-slate-100 pl-8 relative z-10 p-2 text-left">
              
              {/* Hanging Vertical Gray Ribbon */}
              <div className="absolute top-0 right-4 w-28 h-72 bg-[#f1f1f0] border-b border-l border-r border-slate-200/60 shadow-sm flex flex-col items-center justify-between pb-6 rounded-b-md print:bg-[#f1f1f0]">
                <div className="w-full bg-slate-300/40 h-[6px]"></div>
                {/* Vertical Ribbon Text */}
                <span className="text-[8px] font-sans font-black tracking-[0.45em] text-slate-500 uppercase select-none [writing-mode:vertical-lr] my-auto">
                  COURSE CERTIFICATE
                </span>
                
                {/* Circular Crest Seal */}
                <div className="w-20 h-20 rounded-full border-[3px] border-double border-slate-400/80 bg-white flex items-center justify-center shadow-soft">
                  <div className="w-14 h-14 rounded-full border border-dashed border-slate-300 flex flex-col items-center justify-center text-[6.5px] font-bold text-slate-400 tracking-tighter scale-95 leading-tight">
                    <span>EDUCATION</span>
                    <span className="font-black text-slate-800 font-serif text-[7.5px] py-0.5">examly</span>
                    <span>VERIFIED</span>
                  </div>
                </div>
              </div>

              {/* Bottom-right: Verification links */}
              <div className="mt-auto space-y-3 pt-64">
                <div className="space-y-1">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Verify at:</p>
                  <a 
                    href={`${window.location.origin}/verify-certificate/${certificate.certificate_code}`}
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-[9.5px] text-blue-600 hover:underline font-mono break-all font-semibold"
                  >
                    examy.org/verify/{certificate.certificate_code}
                  </a>
                </div>
                <p className="text-[8.5px] text-slate-400 leading-normal">
                  Examly has confirmed the identity of this individual and their participation in the course.
                </p>
              </div>

            </div>

            {/* Footer Legal/Disclaimer Banner (Full Width) */}
            <div className="col-span-12 border-t border-slate-200 mt-6 pt-4 text-center z-10">
              <p className="text-[7.5px] text-slate-400 leading-normal max-w-2xl mx-auto">
                This certificate attests to the learner's completion of an online course / project delivered via Examly. It does not constitute formal academic enrollment at any university or entity and does not itself grant academic credit, grades, or a degree.
              </p>
            </div>

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
