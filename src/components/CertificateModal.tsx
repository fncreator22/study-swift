import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, Share2, Award, CheckCircle } from "lucide-react";
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

  const scorePct = certificate.total > 0 ? Math.round((certificate.score / certificate.total) * 100) : 0;
  const issueDate = new Date(certificate.issued_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
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
        
        {/* Certificate Layout */}
        <div 
          id="certificate-print-area"
          className="relative p-12 bg-[#faf7f2] border-[16px] border-double border-[#d4af37] text-slate-800 font-sans select-none print:p-8 print:border-[12px] print:bg-white"
          style={{ minHeight: "560px" }}
        >
          {/* Decorative Corner Borders */}
          <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-[#d4af37]"></div>
          <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-[#d4af37]"></div>
          <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-[#d4af37]"></div>
          <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-[#d4af37]"></div>

          <div className="text-center space-y-6">
            
            {/* Header Logo & Brand */}
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#1e293b] text-[#d4af37]">
                <Award className="h-10 w-10 stroke-[1.5]" />
              </div>
              <span className="font-display text-lg font-black tracking-widest text-[#1e293b]">EXAMLY ACADEMY</span>
              <div className="w-20 h-0.5 bg-[#d4af37] mx-auto mt-1"></div>
            </div>

            {/* Certificate Title */}
            <div className="space-y-1">
              <h1 className="font-serif text-3xl font-bold tracking-wide text-[#1e293b] uppercase print:text-2xl">
                Certificate of Completion
              </h1>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                This document certifies the successful fulfillment of course requirements
              </p>
            </div>

            {/* Recipient Name Container */}
            <div className="py-2 space-y-1">
              <p className="text-xs italic text-slate-500">This is proudly presented to</p>
              <h2 className="font-serif text-4xl font-extrabold text-[#111827] border-b border-dashed border-slate-300 pb-2 max-w-md mx-auto print:text-3xl">
                {certificate.recipient_name}
              </h2>
              {certificate.date_of_birth && (
                <p className="text-[10px] text-muted-foreground">Born on {new Date(certificate.date_of_birth).toLocaleDateString()}</p>
              )}
            </div>

            {/* Course Title Detail */}
            <div className="max-w-xl mx-auto space-y-2">
              <p className="text-sm leading-relaxed">
                for demonstrating proficiency and mastering modules for the professional training course
              </p>
              <h3 className="font-display text-xl font-black text-[#1d4ed8] print:text-lg">
                {certificate.course_title}
              </h3>
            </div>

            {/* Scoring and Grades */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold">
              <CheckCircle className="h-4 w-4" /> Certification Exam Score: {scorePct}% Passed
            </div>

            {/* Footer Signatures, Verification Code, and Stamp */}
            <div className="grid grid-cols-3 gap-6 pt-10 items-end max-w-2xl mx-auto">
              
              {/* Authorized signature */}
              <div className="text-center space-y-1">
                <p className="font-serif text-sm italic text-[#1e293b] select-none font-bold">
                  Examly Board
                </p>
                <div className="w-full h-px bg-slate-300 mx-auto"></div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Authorized Signature</p>
              </div>

              {/* Gold Verification Stamp */}
              <div className="flex justify-center relative">
                <div className="w-20 h-20 rounded-full border-4 border-double border-[#d4af37] bg-amber-50 flex items-center justify-center shadow-inner relative">
                  <div className="absolute inset-2 rounded-full border border-dashed border-[#d4af37] flex flex-col items-center justify-center text-[9px] font-black text-[#d4af37] tracking-tighter">
                    <span>OFFICIAL</span>
                    <span>STAMP</span>
                  </div>
                </div>
              </div>

              {/* Issue Date & Code */}
              <div className="text-center space-y-1">
                <p className="text-xs font-bold text-slate-800">{issueDate}</p>
                <div className="w-full h-px bg-slate-300 mx-auto"></div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Date of Issue</p>
              </div>

            </div>

            {/* Verification Metadata Footer */}
            <div className="pt-4 text-center">
              <p className="text-[9px] font-mono text-slate-400 tracking-wider">
                Verification Code: <span className="font-bold text-slate-600">{certificate.certificate_code}</span> · Verify authenticity at examly.edu/verify
              </p>
            </div>

          </div>
        </div>

        {/* Certificate Modal Control Buttons (Hidden during Print) */}
        <div className="flex items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50 print:hidden">
          <p className="text-xs text-muted-foreground italic">
            Tip: Select "Save as PDF" and choose "Landscape" layout in the print dialog.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" /> Share Link
            </Button>
            <Button size="sm" onClick={handlePrint} className="bg-[#1e293b] hover:bg-[#0f172a] text-white">
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
              border: 12px double #d4af37 !important;
              background-color: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            @page {
              size: landscape;
              margin: 0.5cm;
            }
          }
        `}} />

      </DialogContent>
    </Dialog>
  );
}
