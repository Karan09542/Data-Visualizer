import React, { useState } from "react";
import { Sparkles, ShieldCheck, BadgeCheck, CreditCard, Globe, FileText } from "lucide-react";
import { PassportPrintModal } from "../image-workspace/components/shared/PassportPrintModal";
import { FileDropzoneUpload } from "./FileDropzoneUpload";

export function PassportStudioUtil() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [autoAdjust, setAutoAdjust] = useState(false);

  // Curated sample passport photos for instant testing across standards
  const SAMPLE_PASSPORT_PHOTOS = [
    {
      label: "Woman Portrait",
      url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
      badge: "Schengen 35×45",
      description: "Indian & EU format"
    }
  ];

  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setIsModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const launchWithImage = (imgSrc: string) => {
    setSelectedImage(imgSrc);
    setIsModalOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto custom-scrollbar">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Passport Photo Studio
            </h2>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
              <Sparkles size={10} /> 300 / 600 DPI
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Commercial passport grid generator with camera capture, scissor guidelines, custom photo count & KB size compression.
          </p>
        </div>

        {/* Auto Adjust Toggle Switch */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Auto-Adjust
          </span>
          <button
            type="button"
            onClick={() => setAutoAdjust(!autoAdjust)}
            className={`w-9 h-5 rounded-full transition-colors relative flex items-center ${autoAdjust ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}
          >
            <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transform transition-transform ${autoAdjust ? 'translate-x-[18px]' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>


      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto mt-5 space-y-6">
        {/* File Dropzone Upload Zone with Camera and Sample Photo */}
        <FileDropzoneUpload
          onFileSelected={handleImageFile}
          accept="image/*"
          title="Drop Photo for Passport Studio"
          subtitle="JPG, PNG, WEBP high-res photo • or tap to browse"
          accentColor="blue"
          enableCamera={true}
          sampleImages={SAMPLE_PASSPORT_PHOTOS}
          onSampleSelect={launchWithImage}
          className="w-full"
        />

        {/* Official Document Size Presets Overview */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-blue-500" /> Standard Document Presets Included
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[
              { name: "Indian Passport", desc: "35 × 45 mm", icon: <BadgeCheck size={16} className="text-blue-500" /> },
              { name: "Aadhaar / PAN", desc: "2 × 2 in (51×51mm)", icon: <CreditCard size={16} className="text-emerald-500" /> },
              { name: "Schengen Visa", desc: "35 × 45 mm", icon: <Globe size={16} className="text-indigo-500" /> },
              { name: "US Passport & Visa", desc: "2 × 2 in (51×51mm)", icon: <FileText size={16} className="text-rose-500" /> },
              { name: "UK Visa", desc: "35 × 45 mm", icon: <Globe size={16} className="text-purple-500" /> },
              { name: "Canada Visa", desc: "50 × 70 mm", icon: <Globe size={16} className="text-amber-500" /> },
            ].map((preset) => (
              <div
                key={preset.name}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161c26] flex items-center gap-2.5 shadow-sm"
              >
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 shrink-0">
                  {preset.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {preset.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {preset.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* External Utilities via Modals */}
      {isModalOpen && selectedImage && (
        <PassportPrintModal
          sourceImage={selectedImage}
          onClose={() => setIsModalOpen(false)}
          initialAutoAdjust={autoAdjust}
        />
      )}
    </div>
  );
}
