import React, { useEffect, useState } from 'react';
import { Download, Send, Loader2 } from 'lucide-react';
import MediaCarousel from '../MediaCarousel';
import { InteractiveZoomImage } from '../InteractiveZoomImage';
import { PdfViewer } from '../PdfViewer';
import { SafeModelViewer } from '../SafeModelViewer';
import { formatFileSize } from '../../lib/formatFileSize';
import { getReceivedFile, type ReceivedFileRecord } from '../../utils/transferReceivedStore';
import { FileTypeIcon, fileFamily } from './FileTypeIcon';

interface Props {
  items: ReceivedFileRecord[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  isDark: boolean;
  canSend: boolean;
  onSave: (r: ReceivedFileRecord) => void;
  onSend: (r: ReceivedFileRecord) => void;
}

const TEXT_LIMIT = 1024 * 1024; // show text files up to 1 MB inline

/** One received file, read from browser storage while it is shown and released after. */
function ReceivedItem({ rec, isDark, onSave }: { rec: ReceivedFileRecord; isDark: boolean; onSave: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const family = fileFamily(rec.name, rec.mime);
  const showsText = (family === 'text' || family === 'code') && rec.size <= TEXT_LIMIT;

  useEffect(() => {
    let live = true;
    let made: string | null = null;
    getReceivedFile(rec.id).then(async (f) => {
      if (!live) return;
      if (!f) return setMissing(true);
      if (showsText) setText(await f.text());
      else setUrl((made = URL.createObjectURL(f)));
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [rec.id, showsText]);

  const card = (extra?: React.ReactNode) => (
    <div className={`w-[min(360px,calc(100%-32px))] rounded-3xl p-8 flex flex-col items-center text-center pointer-events-auto border ${isDark ? 'bg-[#141b29] border-white/10' : 'bg-white border-slate-200'}`}>
      <div className="relative h-20 w-20 rounded-2xl overflow-hidden mb-5">
        <FileTypeIcon name={rec.name} mime={rec.mime} size={34} label fill />
      </div>
      <p className={`text-sm font-semibold break-all line-clamp-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{rec.name}</p>
      <p className="mt-1 text-xs text-slate-500">{formatFileSize(rec.size, 'B', 1)}</p>
      {extra}
      <button
        onClick={onSave}
        className="mt-6 w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
      >
        <Download size={16} /> Save to device
      </button>
    </div>
  );

  if (missing) return card(<p className="mt-3 text-xs text-amber-500">This file is no longer stored in the browser.</p>);
  if (showsText) {
    return text === null ? (
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    ) : (
      <div className="w-full h-full pt-16 sm:pt-20 pb-4 sm:pb-8 px-3 sm:px-8 max-w-5xl flex flex-col pointer-events-auto">
        <pre className="flex-1 overflow-auto rounded-2xl bg-[#1e1e1e] p-5 text-xs sm:text-sm font-mono text-slate-300 whitespace-pre-wrap break-words select-text">{text}</pre>
      </div>
    );
  }
  if (!url) return <Loader2 className="w-6 h-6 animate-spin text-slate-400" />;

  switch (family) {
    case 'image':
      return (
        <div className="w-full h-full relative flex items-center justify-center pointer-events-auto">
          <InteractiveZoomImage src={url} alt={rec.name} className="rounded-xl shadow-2xl" />
        </div>
      );
    case 'video':
      return (
        <div className="w-full h-full pt-16 pb-6 px-2 sm:px-8 flex items-center justify-center pointer-events-auto">
          <video src={url} controls autoPlay playsInline className="max-w-full max-h-full rounded-xl bg-black shadow-2xl" />
        </div>
      );
    case 'audio':
      return card(<audio src={url} controls autoPlay className="mt-5 w-full" />);
    case 'pdf':
      return (
        <div className="w-full h-full pt-16 sm:pt-20 pb-4 sm:pb-8 px-2 sm:px-6 max-w-5xl flex flex-col pointer-events-auto">
          <div className={`flex-1 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl relative ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
            <PdfViewer url={url} fileName={rec.name} isDark={isDark} />
          </div>
        </div>
      );
    case 'model':
      if (/\.(glb|gltf)$/i.test(rec.name)) {
        return (
          <div className="w-full h-full relative pointer-events-auto bg-[#0d1017]">
            <SafeModelViewer src={url} alt={rec.name} autoRotate cameraControls showControls />
          </div>
        );
      }
      return card();
    default:
      return card();
  }
}

/** Received files, one at a time: next and back move through the received files themselves. */
export function ReceivedViewer({ items, index, onIndexChange, onClose, isDark, canSend, onSave, onSend }: Props) {
  return (
    <MediaCarousel
      isOpen
      onClose={onClose}
      items={items}
      selectedIndex={index}
      onIndexChange={onIndexChange}
      isDark={isDark}
      renderItem={(rec, isSelected) => (isSelected ? <ReceivedItem key={rec.id} rec={rec} isDark={isDark} onSave={() => onSave(rec)} /> : null)}
      renderHeaderMiddle={(rec, i, total) => (
        <>
          <p className={`text-sm font-semibold truncate w-full px-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>{rec.name}</p>
          <p className="text-[11px] text-slate-400 tabular-nums">
            {i + 1} of {total} · {formatFileSize(rec.size, 'B', 1)}
          </p>
        </>
      )}
      renderHeaderRight={(rec) => (
        <div className="flex items-center gap-1.5">
          {canSend && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSend(rec);
              }}
              className={`h-9 w-9 inline-flex items-center justify-center rounded-full ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}
              title="Send to the connected device"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSave(rec);
            }}
            className={`h-9 w-9 inline-flex items-center justify-center rounded-full ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}
            title="Save to device"
            aria-label="Save to device"
          >
            <Download size={16} />
          </button>
        </div>
      )}
    />
  );
}
