import { formatFileSize } from "../../../lib/formatFileSize";
import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Check, FileImage, Image as ImageIcon, Box } from 'lucide-react';
import { discoverAllAssets } from '../services/assetDiscovery';
import { GalleryAsset } from '../providers/indexedDbProvider';

interface AssetGalleryProps {
  onClose: () => void;
  onImport: (assets: {url: string, type: 'image' | 'svg', name?: string}[]) => void;
}

export function formatBytes(bytes: number, decimals = 2) {
    return formatFileSize(bytes, 'B', decimals);
}

export function AssetGallery({ onClose, onImport }: AssetGalleryProps) {
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    discoverAllAssets().then(found => {
      setAssets(found);
      setLoading(false);
    });
  }, []);

  const filteredAssets = useMemo(() => {
    if (!search.trim()) return assets;
    const lowerSearch = search.toLowerCase();
    return assets.filter(a => 
      a.filename.toLowerCase().includes(lowerSearch) || 
      a.source.toLowerCase().includes(lowerSearch)
    );
  }, [assets, search]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleImport = () => {
    const selected = assets.filter(a => selectedIds.has(a.id)).map(a => {
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

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#111] border border-[#222] rounded-xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#222] bg-[#161616]">
          <div className="flex items-center gap-2">
            <Box size={20} className="text-blue-400" />
            <h2 className="text-white font-medium text-lg">Local Asset Gallery</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#222] rounded-lg text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-[#222] flex gap-4 items-center bg-[#181818]">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search assets..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#111] border border-[#333] rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
          <div className="flex-1" />
          <div className="text-slate-400 text-sm">
            {selectedIds.size} selected
          </div>
          <button 
            disabled={selectedIds.size === 0}
            onClick={handleImport}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            Import {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>
        </div>

        {/* Gallery Grid */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center text-slate-500">
              Loading assets...
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-4">
              <FileImage size={48} className="opacity-20" />
              <p>No assets found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredAssets.map(asset => {
                const isSelected = selectedIds.has(asset.id);
                const isSvg = asset.mimeType.includes('svg') || asset.url.includes('.svg');
                
                return (
                  <div 
                    key={asset.id} 
                    onClick={() => toggleSelect(asset.id)}
                    className={`relative group bg-[#161616] border ${isSelected ? 'border-blue-500' : 'border-[#222] hover:border-[#444]'} rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg`}
                  >
                    <div className="aspect-square bg-[#0a0a0a] relative flex items-center justify-center p-2">
                       <img 
                         src={asset.thumbnailUrl || asset.url} 
                         alt={asset.filename} 
                         loading="lazy"
                         className="w-full h-full object-contain pointer-events-none"
                       />
                       {isSelected && (
                         <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1 shadow-md">
                           <Check size={14} strokeWidth={3} />
                         </div>
                       )}
                       <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase">
                          {isSvg ? 'SVG' : asset.mimeType.replace('image/', '')}
                       </div>
                    </div>
                    <div className="p-3 border-t border-[#222]">
                      <h3 className="text-sm font-medium text-white truncate mb-1" title={asset.filename}>{asset.filename}</h3>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate">{asset.source}</span>
                        {asset.size ? <span>{formatBytes(asset.size)}</span> : null}
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
