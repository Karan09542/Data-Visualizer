import React, { useState } from "react";
import { Upload, Camera, Sparkles, ArrowRight, ShieldCheck, BadgeCheck, CreditCard, Globe, FileText } from "lucide-react";
import { PassportPrintModal } from "../image-workspace/components/shared/PassportPrintModal";
import { CameraCaptureModal } from "../CameraCaptureModal";

export function PassportStudioUtil() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Default sample passport photo for instant testing
  const sampleImage = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setIsModalOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setIsModalOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleCameraCapture = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setIsCameraOpen(false);
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
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Passport Photo Studio
            </h2>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
              <Sparkles size={10} /> 300 / 600 DPI
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Commercial passport grid generator with camera capture, scissor guidelines, custom photo count & KB size compression.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-5 space-y-6">
        {/* Upload & Camera Capture Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Option 1: Drag & Drop Upload Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-6 text-center transition-all bg-white dark:bg-[#12161f] group cursor-pointer shadow-sm hover:shadow-md flex flex-col items-center justify-center space-y-3 min-h-[160px]"
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />

            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl group-hover:scale-110 transition-transform">
              <Upload size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Click or Drop Photo File
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                JPG, PNG, WEBP high-res files
              </p>
            </div>
          </div>

          {/* Option 2: Live Camera Capture Button */}
          <div
            onClick={() => setIsCameraOpen(true)}
            className="border-2 border-dashed border-indigo-300 dark:border-indigo-900/60 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl p-6 text-center transition-all bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-[#12161f] group cursor-pointer shadow-sm hover:shadow-md flex flex-col items-center justify-center space-y-3 min-h-[160px]"
          >
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-2xl group-hover:scale-110 transition-transform shadow-sm">
              <Camera size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5">
                <span>Take Photo with Camera</span>
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Snap directly using Webcam or Phone Camera
              </p>
            </div>
          </div>
        </div>

        {/* Quick Launch Card with Sample Photo */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161f] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <img
              src={sampleImage}
              alt="Sample Portrait"
              className="w-12 h-14 object-cover rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm"
            />
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Don't have a photo ready?
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Test Passport Studio instantly using our sample portrait photo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => launchWithImage(sampleImage)}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 shrink-0"
          >
            <span>Try Sample Photo</span>
            <ArrowRight size={14} />
          </button>
        </div>

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

      {/* Render CameraCaptureModal when requested */}
      {isCameraOpen && (
        <CameraCaptureModal
          onClose={() => setIsCameraOpen(false)}
          onCapture={handleCameraCapture}
        />
      )}

      {/* Render PassportPrintModal when active */}
      {isModalOpen && selectedImage && (
        <PassportPrintModal
          sourceImage={selectedImage}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
