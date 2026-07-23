import { formatFileSize } from "../../../lib/formatFileSize";
import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Check, FileImage, Image as ImageIcon, Box, Globe } from 'lucide-react';
import { discoverAllAssets } from '../services/assetDiscovery';
import { GalleryAsset } from '../providers/indexedDbProvider';
import { createClient } from 'pexels';

interface AssetGalleryProps {
  onClose: () => void;
  onImport: (assets: {url: string, type: 'image' | 'svg', name?: string}[]) => void;
}

export function formatBytes(bytes: number, decimals = 2) {
    return formatFileSize(bytes, 'B', decimals);
}

type UnifiedAsset = {
  id: string;
  url: string;
  thumbnailUrl: string;
  filename: string;
  source: string;
  mimeType: string;
  size?: number;
};

export function AssetGallery({ onClose, onImport }: AssetGalleryProps) {
  const [activeTab, setActiveTab] = useState<'local' | 'pexels'>('local');
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [pexelsPhotos, setPexelsPhotos] = useState<any[]>([]);
  const [pexelsLoading, setPexelsLoading] = useState(false);

  // Store the full objects for selected assets so we can easily import them
  const [selectedAssets, setSelectedAssets] = useState<Map<string, UnifiedAsset>>(new Map());

  const pexelsClient = useMemo(() => {
    const key = import.meta.env.VITE_PEXELS_API_KEY;
    if (key) return createClient(key);
    return null;
  }, []);

  // Fetch local assets
  useEffect(() => {
    discoverAllAssets().then(found => {
      setAssets(found);
      setLoading(false);
    });
  }, []);

  // Fetch pexels assets
  useEffect(() => {
    if (activeTab !== 'pexels') return;
    if (!pexelsClient) {
      setPexelsLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setPexelsLoading(true);
      const query = search.trim();
      
      const request = query 
        ? pexelsClient.photos.search({ query, per_page: 40 })
        : pexelsClient.photos.curated({ per_page: 40 });

      request.then((response: any) => {
        if (response && 'photos' in response) {
          setPexelsPhotos(response.photos);
        } else {
          setPexelsPhotos([]);
        }
      }).catch(err => {
        console.error("Pexels fetch error", err);
      }).finally(() => {
        setPexelsLoading(false);
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [activeTab, search, pexelsClient]);

  // Unified lists
  const displayAssets = useMemo<UnifiedAsset[]>(() => {
    if (activeTab === 'local') {
      let list = assets;
      if (search.trim()) {
        const lowerSearch = search.toLowerCase();
        list = list.filter(a => 
          a.filename.toLowerCase().includes(lowerSearch) || 
          a.source.toLowerCase().includes(lowerSearch)
        );
      }
      return list.map(a => ({
        id: `local-${a.id}`,
        url: a.url,
        thumbnailUrl: a.thumbnailUrl || a.url,
        filename: a.filename,
        source: a.source,
        mimeType: a.mimeType,
        size: a.size
      }));
    } else {
      return pexelsPhotos.map(p => ({
        id: `pexels-${p.id}`,
        url: p.src.large2x || p.src.original,
        thumbnailUrl: p.src.medium || p.src.small,
        filename: p.alt || `Photo by ${p.photographer}`,
        source: `Pexels (${p.photographer})`,
        mimeType: 'image/jpeg',
        size: undefined
      }));
    }
  }, [activeTab, assets, search, pexelsPhotos]);

  const toggleSelect = (asset: UnifiedAsset) => {
    const next = new Map(selectedAssets);
    if (next.has(asset.id)) {
      next.delete(asset.id);
    } else {
      next.set(asset.id, asset);
    }
    setSelectedAssets(next);
  };

  const handleImport = () => {
    const selected = Array.from(selectedAssets.values()).map(a => {
      const typeStr = (a.mimeType.includes('svg') || a.url.includes('.svg') || a.url.startsWith('data:image/svg')) ? 'svg' : 'image';
      return {
        url: a.url,
        type: typeStr as 'svg' | 'image',
        name: a.filename,
        assetId: a.id
      };
    });
    if (selected.length > 0) {
      onImport(selected);
    }
  };

  const isCurrentLoading = activeTab === 'local' ? loading : pexelsLoading;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#111] border border-[#222] sm:rounded-xl w-full max-w-5xl h-full sm:h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border-b border-[#222] bg-[#161616] gap-3 sm:gap-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pr-8 sm:pr-0">
            <div className="flex items-center gap-2 sm:pr-4 sm:border-r border-[#333]">
              <Box size={20} className="text-blue-400 shrink-0" />
              <h2 className="text-white font-medium text-base sm:text-lg whitespace-nowrap">Asset Gallery</h2>
            </div>
            
            <div className="flex items-center gap-1 bg-[#0a0a0a] p-1 rounded-lg border border-[#222] self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('local')}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'local' ? 'bg-[#222] text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Local Assets
              </button>
              <button
                onClick={() => setActiveTab('pexels')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'pexels' ? 'bg-[#222] text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Globe size={14} className="shrink-0" /> Pexels
              </button>
            </div>
          </div>
          <button onClick={onClose} className="absolute right-3 top-3 sm:static sm:right-auto sm:top-auto p-2 hover:bg-[#222] rounded-lg text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 sm:p-4 border-b border-[#222] flex flex-wrap gap-3 sm:gap-4 items-center bg-[#181818]">
          <div className="relative flex-1 min-w-[200px] w-full sm:max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder={activeTab === 'local' ? "Search local assets..." : "Search Pexels..."}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#111] border border-[#333] rounded-lg pl-9 pr-3 sm:pl-10 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
          <div className="flex-1 hidden sm:block" />
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-slate-400 text-xs sm:text-sm whitespace-nowrap">
              {selectedAssets.size} selected
            </div>
            <button 
              disabled={selectedAssets.size === 0}
              onClick={handleImport}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap"
            >
              Import {selectedAssets.size > 0 ? `(${selectedAssets.size})` : ''}
            </button>
          </div>
        </div>

        {activeTab === 'pexels' && !import.meta.env.VITE_PEXELS_API_KEY && (
           <div className="bg-red-500/10 border-b border-red-500/20 p-3 text-red-400 text-xs text-center flex flex-col justify-center gap-1">
             <span className="font-bold">Missing Pexels API Key</span>
             <span>Please add VITE_PEXELS_API_KEY to your environment variables to use this feature.</span>
           </div>
        )}

        {/* Gallery Grid */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#0D0D0D]">
          {isCurrentLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-4">
              <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              <p>Loading assets...</p>
            </div>
          ) : displayAssets.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-4">
              {activeTab === 'pexels' ? <Globe size={48} className="opacity-20" /> : <FileImage size={48} className="opacity-20" />}
              <p>No assets found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {displayAssets.map(asset => {
                const isSelected = selectedAssets.has(asset.id);
                const isSvg = asset.mimeType.includes('svg') || asset.url.includes('.svg');
                
                return (
                  <div 
                    key={asset.id} 
                    onClick={() => toggleSelect(asset)}
                    className={`relative group bg-[#161616] border ${isSelected ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'border-[#222] hover:border-[#444]'} rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg`}
                  >
                    <div className="aspect-square bg-[#0a0a0a] relative flex items-center justify-center p-2">
                       <img 
                         src={asset.thumbnailUrl} 
                         alt={asset.filename} 
                         loading="lazy"
                         className="w-full h-full object-cover rounded-md pointer-events-none"
                       />
                       {isSelected && (
                         <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1 shadow-md animate-in zoom-in">
                           <Check size={14} strokeWidth={3} />
                         </div>
                       )}
                       <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-widest">
                          {isSvg ? 'SVG' : asset.mimeType.replace('image/', '')}
                       </div>
                    </div>
                    <div className="p-3 border-t border-[#222]">
                      <h3 className="text-[12px] font-semibold text-white truncate mb-1" title={asset.filename}>{asset.filename}</h3>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="truncate flex-1">{asset.source}</span>
                        {asset.size ? <span className="ml-2 font-mono">{formatBytes(asset.size)}</span> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
