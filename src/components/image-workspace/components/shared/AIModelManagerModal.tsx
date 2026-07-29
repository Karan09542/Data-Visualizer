import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Trash2, HardDrive, CheckCircle2, Loader2, Upload, Cpu, FileBox, Settings, Save } from 'lucide-react';
import { modelRegistry } from '../../../../ai/registry/ModelRegistry';
import { useModel } from '../../../../ai/hooks/useModel';
import { ModelManifest } from '../../../../ai/types';
import { formatFileSize } from '@/src/lib/formatFileSize';
import { opfsStorage } from '../../../../ai/manager/OPFSStorage';
import { ModelConfig, NormalizationType } from '../../../../ai/config/ModelConfig';

interface AIModelManagerModalProps {
  onClose: () => void;
}

const ModelConfigEditor = ({ 
  config, 
  onChange, 
  onSave, 
  onCancel,
  isSaving,
  title = "Model Configuration",
  saveLabel = "Save Configuration"
}: { 
  config: ModelConfig, 
  onChange: (cfg: ModelConfig) => void, 
  onSave: () => void, 
  onCancel: () => void,
  isSaving: boolean,
  title?: string,
  saveLabel?: string
}) => {
  return (
    <div className="p-5 sm:p-6 bg-[#111] border-b border-[#333] flex flex-col gap-6 animate-in slide-in-from-top-2 overflow-y-auto max-h-[60vh] sm:max-h-[70vh] shrink-0 custom-scrollbar">
      <h3 className="text-white font-bold text-lg">{title}</h3>
      
      {/* Tiling Toggle */}
      <div className="flex items-center justify-between p-4 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl hover:border-[#3D3D3D] transition-colors cursor-pointer" onClick={() => onChange({...config, requiresTiling: !config.requiresTiling})}>
        <div>
          <div className="text-sm font-semibold text-white">Requires fixed-size Tiling</div>
          <div className="text-[12px] text-[#8A8A8A] mt-0.5">Split large images into smaller chunks for processing</div>
        </div>
        <div className={`w-11 h-6 rounded-full transition-colors relative flex items-center ${config.requiresTiling ? 'bg-blue-600' : 'bg-[#333]'}`}>
          <div className={`w-4 h-4 bg-white rounded-full absolute transition-transform ${config.requiresTiling ? 'translate-x-6' : 'translate-x-1'}`} />
        </div>
      </div>

      {config.requiresTiling && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
           <div className="flex flex-col gap-1.5">
             <label className="text-[11px] font-bold text-[#8A8A8A] uppercase tracking-wider">Width</label>
             <div className="relative">
               <input type="number" value={config.tileSize?.inputWidth || 0} onChange={e => onChange({...config, tileSize: {...config.tileSize!, inputWidth: +e.target.value}})} className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg pl-3 pr-7 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors" />
               <span className="absolute right-3 top-2.5 text-xs text-[#555]">px</span>
             </div>
           </div>
           <div className="flex flex-col gap-1.5">
             <label className="text-[11px] font-bold text-[#8A8A8A] uppercase tracking-wider">Height</label>
             <div className="relative">
               <input type="number" value={config.tileSize?.inputHeight || 0} onChange={e => onChange({...config, tileSize: {...config.tileSize!, inputHeight: +e.target.value}})} className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg pl-3 pr-7 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors" />
               <span className="absolute right-3 top-2.5 text-xs text-[#555]">px</span>
             </div>
           </div>
           <div className="flex flex-col gap-1.5">
             <label className="text-[11px] font-bold text-[#8A8A8A] uppercase tracking-wider">Scale</label>
             <div className="relative">
               <input type="number" value={config.tileSize?.outputScaleFactor || 1} onChange={e => onChange({...config, tileSize: {...config.tileSize!, outputScaleFactor: +e.target.value}})} className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg pl-3 pr-6 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors" />
               <span className="absolute right-3 top-2.5 text-xs text-[#555]">x</span>
             </div>
           </div>
           <div className="flex flex-col gap-1.5">
             <label className="text-[11px] font-bold text-[#8A8A8A] uppercase tracking-wider">Overlap</label>
             <div className="relative">
               <input type="number" value={config.tileSize?.overlap || 0} onChange={e => onChange({...config, tileSize: {...config.tileSize!, overlap: +e.target.value}})} className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg pl-3 pr-7 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors" />
               <span className="absolute right-3 top-2.5 text-xs text-[#555]">px</span>
             </div>
           </div>
        </div>
      )}

      {/* Normalization Cards */}
      <div className="space-y-3">
        <label className="text-[11px] font-bold text-[#8A8A8A] uppercase tracking-wider">Input Normalization</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'raw_255', label: 'Raw [0-255]', desc: 'No modification' },
            { id: 'zero_to_one', label: 'Normalized [0-1]', desc: 'Divided by 255.0' },
            { id: 'minus_one_to_one', label: 'Centered [-1, 1]', desc: '(Pixel / 127.5) - 1.0' }
          ].map(opt => (
            <div 
              key={opt.id}
              onClick={() => onChange({...config, preprocessing: {...config.preprocessing, normalization: opt.id as NormalizationType}})}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${config.preprocessing.normalization === opt.id ? 'bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-[#1A1A1A] border-[#333] hover:border-[#555]'}`}
            >
              <div className={`text-sm font-semibold ${config.preprocessing.normalization === opt.id ? 'text-blue-400' : 'text-white'}`}>{opt.label}</div>
              <div className="text-[11px] text-[#8A8A8A] mt-1">{opt.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[11px] font-bold text-[#8A8A8A] uppercase tracking-wider">Output Pixel Scaling</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
           <div 
              onClick={() => onChange({...config, postprocessing: {...config.postprocessing, outputNormalized: true}})}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${config.postprocessing.outputNormalized ? 'bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-[#1A1A1A] border-[#333] hover:border-[#555]'}`}
            >
              <div className={`text-sm font-semibold ${config.postprocessing.outputNormalized ? 'text-blue-400' : 'text-white'}`}>Float [0.0 - 1.0]</div>
              <div className="text-[11px] text-[#8A8A8A] mt-1">Multiplied by 255 before render</div>
            </div>
            <div 
              onClick={() => onChange({...config, postprocessing: {...config.postprocessing, outputNormalized: false}})}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${!config.postprocessing.outputNormalized ? 'bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-[#1A1A1A] border-[#333] hover:border-[#555]'}`}
            >
              <div className={`text-sm font-semibold ${!config.postprocessing.outputNormalized ? 'text-blue-400' : 'text-white'}`}>Uint8 [0 - 255]</div>
              <div className="text-[11px] text-[#8A8A8A] mt-1">Rendered directly</div>
            </div>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[11px] font-bold text-[#8A8A8A] uppercase tracking-wider">Color Channel Order</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
           <div 
              onClick={() => onChange({...config, postprocessing: {...config.postprocessing, channelOrder: 'RGB'}})}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${config.postprocessing.channelOrder !== 'BGR' ? 'bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-[#1A1A1A] border-[#333] hover:border-[#555]'}`}
            >
              <div className={`text-sm font-semibold ${config.postprocessing.channelOrder !== 'BGR' ? 'text-blue-400' : 'text-white'}`}>RGB (Standard)</div>
              <div className="text-[11px] text-[#8A8A8A] mt-1">Red, Green, Blue</div>
            </div>
            <div 
              onClick={() => onChange({...config, postprocessing: {...config.postprocessing, channelOrder: 'BGR'}})}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${config.postprocessing.channelOrder === 'BGR' ? 'bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-[#1A1A1A] border-[#333] hover:border-[#555]'}`}
            >
              <div className={`text-sm font-semibold ${config.postprocessing.channelOrder === 'BGR' ? 'text-blue-400' : 'text-white'}`}>BGR (OpenCV)</div>
              <div className="text-[11px] text-[#8A8A8A] mt-1">Blue, Green, Red</div>
            </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button 
          disabled={isSaving}
          onClick={onSave}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 active:scale-95 flex items-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
          {saveLabel}
        </button>
        <button 
          onClick={onCancel}
          className="px-5 py-2.5 bg-[#222] hover:bg-[#333] text-white text-sm font-bold rounded-xl transition-all active:scale-95"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const ModelItem = ({ manifest, onCustomDelete, onEdit }: { manifest: ModelManifest, onCustomDelete?: () => void, onEdit?: (manifest: ModelManifest) => void }) => {
  const { isDownloaded, isDownloading, isChecking, modelSize, preload, deleteModel } = useModel(manifest.id);
  const isLocalBundle = manifest.sources[0]?.type === 'local';
  const isCustom = manifest.version === 'custom';

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteModel();
      if (isCustom) {
        modelRegistry.deleteCustom(manifest.id);
        onCustomDelete?.();
      }
    } catch (err) {
      console.error("Failed to delete model", err);
    }
  };

  return (
    <div className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[#141414] border border-[#2D2D2D] rounded-2xl hover:bg-[#1A1A1A] hover:border-[#3D3D3D] transition-all duration-300 gap-4">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner shrink-0 transition-colors ${isDownloaded ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-[#222] border-[#333] text-slate-500'}`}>
          {isCustom ? <FileBox size={20} /> : <Cpu size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-white text-[15px] truncate flex items-center gap-2">
            {manifest.name}
            {isCustom && <span className="bg-blue-500/20 text-blue-400 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md">Custom</span>}
          </div>
          <div className="text-[12px] text-[#8A8A8A] mt-1 flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] bg-[#222] px-1.5 py-0.5 rounded text-slate-400">v{manifest.version}</span>
            <span>•</span>
            <span className="uppercase tracking-wide">{manifest.task.replace('-', ' ')}</span>
            {isDownloaded && modelSize > 0 && (
              <>
                <span>•</span>
                <span className="text-slate-300">{formatFileSize(modelSize, 'B')}</span>
              </>
            )}
            {isLocalBundle && (
              <>
                <span>•</span>
                <span className="text-slate-500">Bundled</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:ml-4 shrink-0 justify-end">
        {isChecking ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm bg-[#1A1A1A] px-4 py-2 rounded-xl border border-[#222]">
            <Loader2 className="animate-spin" size={16} /> Checking...
          </div>
        ) : isDownloading ? (
          <div className="flex items-center gap-2 text-blue-400 text-sm font-medium bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl">
            <Loader2 className="animate-spin" size={16} /> Downloading...
          </div>
        ) : isDownloaded ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium bg-emerald-500/5 border border-emerald-500/10 px-3 py-2 rounded-xl">
              <CheckCircle2 size={16} /> Installed
            </div>
            {/* Show edit button for custom models */}
            {isCustom && onEdit && manifest.customConfig && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(manifest); }}
                className="p-2.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all border border-transparent hover:border-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                title="Edit Settings"
              >
                <Settings size={18} />
              </button>
            )}
            {/* Show delete button for all installed models so user can free cache space */}
            <button
              onClick={handleDelete}
              className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/40"
              title="Delete Model Cache"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={preload}
            className="flex items-center gap-2 bg-white text-black hover:bg-slate-200 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-white/5"
          >
            <Download size={16} /> Download
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
  const [showConfig, setShowConfig] = useState(false);
  const [uploadType, setUploadType] = useState<'esrgan' | 'mirnet' | null>(null);
  const [editingModel, setEditingModel] = useState<ModelManifest | null>(null);
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    id: 'custom',
    name: 'Custom Model',
    requiresTiling: true,
    tileSize: { inputWidth: 128, inputHeight: 128, outputScaleFactor: 4, overlap: 16 },
    preprocessing: { normalization: 'zero_to_one', channels: 3 },
    postprocessing: { outputNormalized: true, channelOrder: 'RGB' }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const refreshModels = () => {
    setModels([...modelRegistry.getAll()]); // Ensure a new array reference to force re-render
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
    }
  };

  const handleTypeSelect = (type: 'esrgan' | 'mirnet') => {
    setUploadType(type);
    if (type === 'esrgan') {
      setModelConfig(prev => ({
        ...prev,
        preprocessing: { ...prev.preprocessing, normalization: 'raw_255' },
        postprocessing: { ...prev.postprocessing, outputNormalized: false, channelOrder: 'RGB' }
      }));
      setShowConfig(true);
    } else {
      handleUpload(type, undefined);
    }
  };

  const handleUpload = async (type: 'esrgan' | 'mirnet', config?: ModelConfig) => {
    if (!uploadFile) return;
    setIsUploading(true);
    try {
      const buffer = await uploadFile.arrayBuffer();
      const customId = `${type}-custom-${Date.now()}`;
      const modelName = uploadFile.name.replace('.tflite', '');
      
      const manifest: ModelManifest = {
        id: customId,
        version: 'custom',
        task: type === 'esrgan' ? 'upscale' : 'low-light',
        name: modelName,
        description: 'Custom user uploaded model',
        sources: [{ type: 'custom' as any, url: uploadFile.name }],
        supports: type === 'esrgan' ? ['upscale'] : ['enhance'],
        customConfig: config ? { ...config, id: customId, name: modelName } : undefined
      };
      await opfsStorage.saveModel(manifest, buffer);
      modelRegistry.registerCustom(manifest);
      setUploadFile(null);
      setShowConfig(false);
      setUploadType(null);
      refreshModels();
    } catch (e) {
      console.error(e);
      alert('Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleEdit = (manifest: ModelManifest) => {
    if (manifest.customConfig) {
      setModelConfig({...manifest.customConfig});
      setEditingModel(manifest);
      setShowConfig(true);
      setUploadType(null);
    }
  };

  const handleSaveEdit = () => {
    if (!editingModel) return;
    const updatedManifest = { ...editingModel, customConfig: modelConfig };
    modelRegistry.registerCustom(updatedManifest);
    setEditingModel(null);
    setShowConfig(false);
    refreshModels();
  };

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-6 font-sans animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
      <div className="bg-[#0A0A0A] sm:border border-[#2D2D2D] sm:rounded-3xl w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] max-w-3xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 sm:p-8 border-b border-[#222] bg-[#0A0A0A] shrink-0 sticky top-0 z-10">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-3 tracking-tight">
              <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <HardDrive size={22} className="text-blue-400" />
              </div>
              Model Manager
            </h2>
            <p className="text-sm text-[#8A8A8A] mt-2 max-w-md leading-relaxed hidden sm:block">
              Manage local AI models. Models execute completely offline in your browser, preserving privacy and saving bandwidth.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-[#1A1A1A] hover:bg-[#222] border border-[#333] hover:border-[#444] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-sm"
            >
              <Upload size={16} className="text-blue-400" /> <span className="hidden sm:inline">Upload Custom</span><span className="sm:hidden">Upload</span>
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".tflite" onChange={handleFileChange} />
            <button
              onClick={onClose}
              className="p-2.5 text-slate-400 hover:text-white hover:bg-[#1A1A1A] rounded-xl transition-colors border border-transparent hover:border-[#333]"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Upload Banner */}
        {uploadFile && !showConfig && (
          <div className="p-5 sm:p-6 bg-blue-500/10 border-b border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-2 shrink-0">
            <div>
              <div className="text-[15px] font-bold text-blue-400 flex items-center gap-2">
                <FileBox size={18} /> {uploadFile.name}
              </div>
              <div className="text-sm text-blue-400/80 mt-1">Select the model architecture type to install:</div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button 
                disabled={isUploading}
                onClick={() => handleTypeSelect('esrgan')}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 active:scale-95 flex-1 sm:flex-none text-center"
              >
                ESRGAN (Upscale)
              </button>
              <button 
                disabled={isUploading}
                onClick={() => handleTypeSelect('mirnet')}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 active:scale-95 flex-1 sm:flex-none text-center"
              >
                MIRNet (Low Light)
              </button>
              <button 
                disabled={isUploading}
                onClick={() => { setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="p-2.5 text-blue-300 hover:text-white bg-black/20 hover:bg-black/40 rounded-xl transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Config Form for ESRGAN */}
        {showConfig ? (
          <ModelConfigEditor 
            config={modelConfig} 
            onChange={setModelConfig} 
            onSave={() => editingModel ? handleSaveEdit() : handleUpload('esrgan', modelConfig)}
            onCancel={() => { setShowConfig(false); setUploadType(null); setEditingModel(null); }}
            isSaving={isUploading}
            title={editingModel ? `Edit Configuration: ${editingModel.name}` : "Model Configuration"}
            saveLabel={editingModel ? "Save Changes" : "Confirm & Upload"}
          />
        ) : (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-[#0A0A0A]">
            {models.map(manifest => (
              <ModelItem key={`${manifest.id}-${manifest.version}`} manifest={manifest} onCustomDelete={refreshModels} onEdit={handleEdit} />
            ))}
            {models.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-[#555]">
                <HardDrive size={48} className="mb-4 opacity-50" />
                <div className="text-lg font-bold text-white mb-1">No Models Found</div>
                <div className="text-sm">There are no AI models registered in the platform.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
