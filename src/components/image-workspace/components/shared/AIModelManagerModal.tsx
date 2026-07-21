import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Trash2, HardDrive, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { modelRegistry } from '../../../../ai/registry/ModelRegistry';
import { useModel } from '../../../../ai/hooks/useModel';
import { ModelManifest } from '../../../../ai/types';
import { formatFileSize } from '@/src/lib/formatFileSize';
import { opfsStorage } from '../../../../ai/manager/OPFSStorage';

interface AIModelManagerModalProps {
  onClose: () => void;
}

const ModelItem = ({ manifest, onCustomDelete }: { manifest: ModelManifest, onCustomDelete?: () => void }) => {
  const { isDownloaded, isDownloading, isChecking, modelSize, preload, deleteModel } = useModel(manifest.id);

  return (
    <div className="flex items-center justify-between p-4 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl hover:border-[#4A4A4A] transition-colors">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${isDownloaded ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-[#252525] border-[#333] text-slate-400'}`}>
          <HardDrive size={18} />
        </div>
        <div>
          <div className="font-semibold text-white text-sm">{manifest.name}</div>
          <div className="text-xs text-[#8A8A8A] mt-0.5 flex items-center gap-2">
            <span>v{manifest.version}</span>
            <span>•</span>
            <span className="uppercase">{manifest.task.replace('-', ' ')}</span>
            {isDownloaded && modelSize > 0 && (
              <>
                <span>•</span>
                <span>{formatFileSize(modelSize, 'B')}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isChecking ? (
          <Loader2 className="animate-spin text-slate-500" size={18} />
        ) : isDownloading ? (
          <div className="flex items-center gap-2 text-blue-400 text-xs font-medium bg-blue-500/10 px-3 py-1.5 rounded-lg">
            <Loader2 className="animate-spin" size={14} /> Downloading...
          </div>
        ) : isDownloaded ? (
          <>
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium px-2">
              <CheckCircle2 size={14} /> Installed
            </div>
            {manifest.sources[0]?.type !== 'local' && (
              <button
                onClick={async () => {
                  await deleteModel();
                  if (manifest.version === 'custom') {
                    modelRegistry.deleteCustom(manifest.id);
                    onCustomDelete?.();
                  }
                }}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                title="Delete Model"
              >
                <Trash2 size={16} />
              </button>
            )}
          </>
        ) : (
          <button
            onClick={preload}
            className="flex items-center gap-2 bg-[#2E2E2E] hover:bg-[#3A3A3A] text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border border-[#444]"
          >
            <Download size={14} /> Download
          </button>
        )}
      </div>
    </div>
  );
};

export const AIModelManagerModal: React.FC<AIModelManagerModalProps> = ({ onClose }) => {
  const [models, setModels] = useState(() => modelRegistry.getAll());
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshModels = () => setModels(modelRegistry.getAll());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
    }
  };

  const handleUpload = async (type: 'esrgan' | 'mirnet') => {
    if (!uploadFile) return;
    setIsUploading(true);
    try {
      const buffer = await uploadFile.arrayBuffer();
      const manifest: ModelManifest = {
        id: type,
        version: 'custom',
        task: type === 'esrgan' ? 'upscale' : 'low-light',
        name: type === 'esrgan' ? 'ESRGAN (Custom)' : 'MIRNet (Custom)',
        description: 'Custom user uploaded model',
        sources: [{ type: 'custom' as any, url: uploadFile.name }],
        supports: type === 'esrgan' ? ['upscale'] : ['enhance']
      };
      await opfsStorage.saveModel(manifest, buffer);
      modelRegistry.registerCustom(manifest);
      setUploadFile(null);
      refreshModels();
    } catch (e) {
      console.error(e);
      alert('Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans" style={{ zIndex: 99999 }}>
      <div className="bg-[#141414] border border-[#2D2D2D] rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-[#2D2D2D]">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <HardDrive size={18} className="text-blue-400" /> AI Model Manager
            </h2>
            <p className="text-xs text-[#8A8A8A] mt-1">
              Download models locally to your browser (OPFS). Models run completely offline and preserve privacy.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              <Upload size={14} /> Upload Custom
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".tflite" onChange={handleFileChange} />
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-[#252525] rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {uploadFile && (
          <div className="p-4 bg-blue-500/10 border-b border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-blue-400">File: {uploadFile.name}</div>
              <div className="text-xs text-blue-400/70">What kind of model is this?</div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                disabled={isUploading}
                onClick={() => handleUpload('esrgan')}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
              >
                ESRGAN (Upscale)
              </button>
              <button 
                disabled={isUploading}
                onClick={() => handleUpload('mirnet')}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
              >
                MIRNet (Low Light)
              </button>
              <button 
                disabled={isUploading}
                onClick={() => { setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="p-1.5 text-slate-400 hover:text-white bg-black/20 rounded-lg ml-2"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {models.map(manifest => (
            <ModelItem key={manifest.id} manifest={manifest} onCustomDelete={refreshModels} />
          ))}
          {models.length === 0 && (
            <div className="text-center py-10 text-[#8A8A8A] text-sm">
              No AI models registered in the platform.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
