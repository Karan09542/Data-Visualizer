import React, { useState, useEffect, useMemo } from 'react';
import { Image as ImageIcon, Upload, Palette, Search, Globe, X, ZoomIn } from 'lucide-react';
import { ColorPickerTrigger } from './ColorPickers';
import { AssetGallery } from '../../../image-import/gallery/AssetGallery';

export interface PassportBackground {
  type: 'color' | 'image';
  color?: string;
  imageUrl?: string;
  imageEl?: HTMLImageElement;
}

interface Props {
  value: PassportBackground;
  onChange: (value: PassportBackground) => void;
  disabled?: boolean;
}

export const PassportBackgroundPicker: React.FC<Props> = ({ value, onChange, disabled }) => {
  const [tab, setTab] = useState<'color' | 'upload' | 'gallery'>('color');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);

  const loadImage = (url: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      onChange({ type: 'image', imageUrl: url, imageEl: img });
    };
    img.onerror = () => console.error("Failed to load background image");
    img.src = url;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      loadImage(url);
    }
  };

  const renderPreview = () => {
    if (value.type === 'color') {
      return <div className="w-full h-full rounded-md" style={{ backgroundColor: value.color || '#ffffff' }} />;
    }
    if (value.type === 'image' && value.imageUrl) {
      return <img src={value.imageUrl} alt="Background Preview" className="w-full h-full object-cover rounded-md" />;
    }
    return <div className="w-full h-full rounded-md bg-white" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 bg-[#0a0a0a] p-1 rounded-lg border border-[#222]">
        <TabBtn active={tab === 'color'} onClick={() => setTab('color')} icon={<Palette size={13} />} label="Color" disabled={disabled} />
        <TabBtn active={tab === 'upload'} onClick={() => setTab('upload')} icon={<Upload size={13} />} label="Upload" disabled={disabled} />
        <TabBtn active={tab === 'gallery'} onClick={() => setTab('gallery')} icon={<Globe size={13} />} label="Gallery" disabled={disabled} />
      </div>

      <div className="flex gap-3">
        {/* Current Preview */}
        <div 
          className="w-12 h-12 rounded-lg border border-[#333] shrink-0 bg-[#0a0a0a] relative group cursor-pointer overflow-hidden flex items-center justify-center transition-all hover:border-slate-400"
          onClick={() => {
             if (value.type === 'image' && value.imageUrl) setPreviewOpen(true);
          }}
        >
          {renderPreview()}
          {value.type === 'image' && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <ZoomIn size={16} className="text-white" />
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 bg-[#0a0a0a] rounded-lg border border-[#222] p-2 min-h-[48px] flex flex-col justify-center">
          {tab === 'color' && (
            <div className="flex items-center gap-2">
              <ColorPickerTrigger 
                color={value.color || '#ffffff'} 
                onChange={(c) => onChange({ type: 'color', color: c })}
                className="w-6 h-6 rounded border border-[#333] shadow-inner cursor-pointer hover:border-slate-400"
              />
              <span className="text-[11px] font-mono text-[#8A8A8A]">{value.color || '#ffffff'}</span>
            </div>
          )}
          
          {tab === 'upload' && (
            <div className="relative">
              <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={disabled} />
              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 border border-dashed border-[#333] rounded py-1.5 hover:border-slate-500 hover:text-slate-300 transition-colors">
                <Upload size={14} />
                <span>Click to upload image</span>
              </div>
            </div>
          )}

          {tab === 'gallery' && (
             <div className="flex flex-col justify-center items-center h-full min-h-[48px]">
               <button 
                 onClick={() => setGalleryModalOpen(true)}
                 className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] hover:bg-[#222] border border-[#333] hover:border-[#444] text-white text-[11px] font-medium rounded-lg transition-all shadow-sm active:scale-95"
                 disabled={disabled}
               >
                 <Search size={14} className="text-slate-400" />
                 Search Asset Gallery
               </button>
             </div>
          )}
        </div>
      </div>

      {/* Asset Gallery Modal */}
      {galleryModalOpen && (
        <AssetGallery 
          onClose={() => setGalleryModalOpen(false)}
          onImport={(assets) => {
             if (assets.length > 0) {
                loadImage(assets[0].url);
                setGalleryModalOpen(false);
             }
          }}
        />
      )}

      {/* Big Preview Modal */}
      {previewOpen && value.type === 'image' && value.imageUrl && (
        <div className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/80 backdrop-blur-sm p-8 animate-in fade-in duration-200" onClick={() => setPreviewOpen(false)}>
           <div className="relative max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
             <button onClick={() => setPreviewOpen(false)} className="absolute -top-10 right-0 p-2 text-slate-400 hover:text-white transition-colors bg-black/50 rounded-full">
                <X size={24} />
             </button>
             <img src={value.imageUrl} alt="Background Big Preview" className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain border border-[#222]" />
             <div className="mt-4 text-center text-slate-400 text-sm">
                This image will be cropped to fit the passport ratio automatically.
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

const TabBtn = ({ active, icon, label, onClick, disabled }: any) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center justify-center gap-1.5 flex-1 py-1 rounded text-[10px] font-semibold transition-all ${
      active ? 'bg-[#222] text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
    } disabled:opacity-40 disabled:cursor-not-allowed`}
  >
    {icon}
    {label}
  </button>
);
