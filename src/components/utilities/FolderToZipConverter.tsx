import React, { useState, useRef } from "react";
import { FolderArchive, Download, AlertCircle, Shield, FolderOpen, FileText, Eye, EyeOff } from "lucide-react";

interface SelectedFile {
  file: File;
  path: string;
}

export const FolderToZipConverter = () => {
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [zipName, setZipName] = useState("archive");
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files).map((file) => ({
        file,
        // Using webkitRelativePath for directory structure
        path: file.webkitRelativePath || file.name,
      }));
      setFiles(selectedFiles);

      // Auto-set zip name based on the root folder name if available
      if (selectedFiles[0] && selectedFiles[0].path.includes("/")) {
        const rootFolder = selectedFiles[0].path.split("/")[0];
        setZipName(rootFolder);
      }
    }
  };

  const generateZip = async () => {
    if (files.length === 0) return;
    setIsCompressing(true);
    setError("");
    setProgress(0);

    try {
      const worker = new Worker(new URL("../../workers/zipWorker.ts", import.meta.url), {
        type: "module",
      });

      worker.onmessage = (e) => {
        const { progress, zipFile, error } = e.data;

        if (progress !== undefined) {
          setProgress(Math.round(progress));
        }

        if (error) {
          console.error(error);
          setError("Failed to create ZIP file. Please try again.");
          setIsCompressing(false);
          setProgress(0);
          worker.terminate();
        }

        if (zipFile) {
          const url = URL.createObjectURL(zipFile);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${zipName || "archive"}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          setIsCompressing(false);
          setProgress(0);
          worker.terminate();
        }
      };

      worker.postMessage({
        id: "folder-zip",
        files: files.map(f => ({ file: f.file, path: f.path })),
        folderName: zipName || "archive"
      });
    } catch (err) {
      console.error(err);
      setError("Failed to create ZIP file. Please try again.");
      setIsCompressing(false);
      setProgress(0);
    }
  };

  const totalSize = files.reduce((acc, f) => acc + f.file.size, 0);

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-4 md:p-8 overflow-y-auto w-full">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-purple-200 dark:border-purple-800/50">
          <FolderArchive size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          Folder to ZIP
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          Compress a folder securely into a ZIP file. Optionally add password protection.
        </p>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        className="w-full h-40 p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-500 rounded-xl bg-slate-50 dark:bg-[#161b22]/50 flex flex-col items-center justify-center cursor-pointer transition-colors mb-6 group"
      >
        <FolderOpen
          size={28}
          className="text-slate-400 group-hover:text-purple-500 mb-2 transition-colors"
        />
        <span className="text-slate-600 dark:text-slate-300 font-medium">
          Click to select a folder
        </span>
        <span className="text-slate-400 text-xs mt-1">Preserves directory structure</span>
        <input
          ref={fileInputRef}
          type="file"
          // @ts-ignore
          webkitdirectory="true"
          directory="true"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {error && (
        <div className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 p-3 rounded-lg mb-6 flex items-center gap-2">
          <AlertCircle size={16} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {files.length > 0 && (
        <div className="w-full flex flex-col gap-5 bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {files.length} File{files.length !== 1 ? "s" : ""} Selected
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Total size: {(totalSize / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              onClick={() => setFiles([])}
              className="text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1 rounded bg-red-50 dark:bg-red-900/10"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                Archive Name
              </label>
              <input
                type="text"
                value={zipName}
                onChange={(e) => setZipName(e.target.value)}
                placeholder="archive"
                className="w-full bg-slate-50 dark:bg-[#0d1117] text-slate-800 dark:text-slate-100 text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
          </div>

          <div className="mt-2">
            <button
              onClick={generateZip}
              disabled={isCompressing || files.length === 0}
              className={`relative w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-white transition-all shadow-sm overflow-hidden ${
                isCompressing || files.length === 0
                  ? "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700 active:scale-[0.98]"
              }`}
            >
              {isCompressing && (
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-purple-800/30 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              )}
              
              <div className="relative flex items-center gap-2">
                {isCompressing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Download size={18} />
                )}
                {isCompressing ? `Compressing (${progress}%)...` : "Create ZIP Archive"}
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
