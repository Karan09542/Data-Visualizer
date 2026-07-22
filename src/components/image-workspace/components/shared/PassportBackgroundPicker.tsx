import React, { useState, useEffect, useMemo } from 'react';
import { Image as ImageIcon, Upload, Palette, Search, Globe, X, ZoomIn } from 'lucide-react';
import { ColorPickerTrigger } from './ColorPickers';
import { createClient } from 'pexels';

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
  const [tab, setTab] = useState<'color' | 'upload' | 'pexels'>('color');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pexelsModalOpen, setPexelsModalOpen] = useState(false);
  
  // Pexels state
  const [search, setSearch] = useState('');
  const [pexelsPhotos, setPexelsPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const pexelsClient = useMemo(() => {
    const key = import.meta.env.VITE_PEXELS_API_KEY;
    if (key) return createClient(key);
    return null;
  }, []);

  // Fetch Pexels images
  useEffect(() => {
    if (tab !== 'pexels' || !pexelsClient) return;

    const timer = setTimeout(() => {
      setLoading(true);
      const query = search.trim();
      const request = query 
        ? pexelsClient.photos.search({ query, per_page: 20 })
        : pexelsClient.photos.curated({ per_page: 20 });

      request.then((response: any) => {
        if (response && 'photos' in response) {
          setPexelsPhotos(response.photos);
        } else {
          setPexelsPhotos([]);
        }
      }).catch(err => {
        console.error("Pexels fetch error", err);
      }).finally(() => {
        setLoading(false);
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [tab, search, pexelsClient]);

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
        <TabBtn active={tab === 'pexels'} onClick={() => setTab('pexels')} icon={<Globe size={13} />} label="Pexels" disabled={disabled} />
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

          {tab === 'pexels' && (
             <div className="flex flex-col justify-center items-center h-full min-h-[48px]">
               <button 
                 onClick={() => setPexelsModalOpen(true)}
                 className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] hover:bg-[#222] border border-[#333] hover:border-[#444] text-white text-[11px] font-medium rounded-lg transition-all shadow-sm active:scale-95"
                 disabled={disabled}
               >
                 <Search size={14} className="text-slate-400" />
                 Search Pexels Gallery
               </button>
             </div>
          )}
        </div>
      </div>

      {/* Pexels Search Modal */}
      {pexelsModalOpen && (
        <div className="fixed inset-0 z-[10070] flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-8 animate-in fade-in duration-200" onClick={() => setPexelsModalOpen(false)}>
           <div className="w-full h-full md:max-w-5xl md:h-[85vh] bg-[#111] border border-[#222] md:rounded-xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
             {/* Header */}
             <div className="flex items-center justify-between p-4 border-b border-[#222] bg-[#161616]">
                <div className="flex items-center gap-2">
                  <Globe size={18} className="text-blue-400" />
                  <h2 className="text-white font-medium text-sm md:text-base">Pexels Backgrounds</h2>
                </div>
                <button onClick={() => setPexelsModalOpen(false)} className="p-2 hover:bg-[#222] rounded-lg text-slate-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
             </div>
             
             {/* Toolbar */}
             <div className="p-3 md:p-4 border-b border-[#222] bg-[#181818]">
               <div className="relative max-w-2xl mx-auto">
                 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                 <input 
                   type="text" 
                   placeholder="Search for studio backgrounds, gradients, nature..."
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   className="w-full bg-[#111] border border-[#333] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                 />
               </div>
             </div>
             
             {/* Grid */}
             <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-[#0D0D0D]">
               {!pexelsClient ? (
                 <div className="flex h-full items-center justify-center text-red-400 text-sm">VITE_PEXELS_API_KEY missing in environment variables.</div>
               ) : loading ? (
                 <div className="flex h-full flex-col gap-4 items-center justify-center text-slate-500 text-sm">
                   <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                   Searching...
                 </div>
               ) : (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 max-w-6xl mx-auto">
                   {pexelsPhotos.map(p => (
                     <div 
                        key={p.id} 
                        onClick={() => {
                          loadImage(p.src.large2x || p.src.original);
                          setPexelsModalOpen(false);
                        }}
                        className={`aspect-[3/4] cursor-pointer rounded-xl border-2 overflow-hidden hover:opacity-80 transition-all hover:shadow-lg bg-[#161616] ${value.imageUrl === (p.src.large2x || p.src.original) ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] scale-[0.98]' : 'border-[#222] hover:border-[#444]'}`}
                     >
                        <img src={p.src.medium} alt="Pexels" className="w-full h-full object-cover pointer-events-none" loading="lazy" />
                     </div>
                   ))}
                 </div>
               )}
             </div>
           </div>
        </div>
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
