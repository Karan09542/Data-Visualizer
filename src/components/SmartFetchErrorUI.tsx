import { useState } from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  Clock, 
  HelpCircle, 
  ShieldAlert, 
  Globe, 
  FileX, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  Info,
  Terminal,
  Image as ImageIcon,
  Video as VideoIcon,
  Music as MusicIcon,
  FileText as PdfIcon,
  Download,
  ExternalLink
} from 'lucide-react';
import { SmartFetchResult } from '../utils/smartJsonFetch';

interface SmartFetchErrorUIProps {
  result: SmartFetchResult;
  onRetry: () => void;
}

export default function SmartFetchErrorUI({ result, onRetry }: SmartFetchErrorUIProps) {
  const [showDetails, setShowDetails] = useState(false);
  const { 
    errorType, 
    errorMessage, 
    source, 
    phase, 
    status, 
    reason, 
    rawText,
    isMedia,
    mediaType,
    mediaUrl,
    contentType,
    fileSize
  } = result;

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  // Decide on best visual elements based on error category
  const getErrorConfig = () => {
    if (isMedia) {
      switch (mediaType) {
        case 'image':
          return {
            title: 'Media Response: Image Loaded',
            icon: <ImageIcon className="w-5 h-5 text-emerald-500" />,
            colorTheme: 'from-emerald-500/10 to-teal-500/5 border-emerald-500/20 dark:border-emerald-500/30'
          };
        case 'video':
          return {
            title: 'Media Response: Video Loaded',
            icon: <VideoIcon className="w-5 h-5 text-cyan-500" />,
            colorTheme: 'from-cyan-500/10 to-blue-500/5 border-cyan-500/20 dark:border-cyan-500/30'
          };
        case 'audio':
          return {
            title: 'Media Response: Audio Stream Loaded',
            icon: <MusicIcon className="w-5 h-5 text-violet-500" />,
            colorTheme: 'from-violet-500/10 to-purple-500/5 border-violet-500/20 dark:border-violet-500/30'
          };
        case 'pdf':
          return {
            title: 'Document Response: PDF Loaded',
            icon: <PdfIcon className="w-5 h-5 text-rose-500" />,
            colorTheme: 'from-rose-500/10 to-pink-500/5 border-rose-500/20 dark:border-rose-500/30'
          };
      }
    }

    switch (errorType) {
      case 'invalid-url':
        return {
          title: 'Invalid Request URL',
          icon: <Globe className="w-5 h-5 text-indigo-500" />,
          colorTheme: 'from-indigo-500/10 to-blue-500/5 border-indigo-500/20 dark:border-indigo-500/30'
        };
      case 'cors-blocked':
        return {
          title: 'Access Restricted (CORS / Blocked)',
          icon: <ShieldAlert className="w-5 h-5 text-rose-500" />,
          colorTheme: 'from-rose-500/10 to-amber-500/5 border-rose-500/20 dark:border-rose-500/30'
        };
      case 'invalid-json':
        return {
          title: 'Invalid JSON Structure',
          icon: <FileX className="w-5 h-5 text-amber-500" />,
          colorTheme: 'from-amber-500/10 to-orange-500/5 border-amber-500/20 dark:border-amber-500/30',
          showPreview: true
        };
      case 'empty-response':
        return {
          title: 'No Data Received',
          icon: <Info className="w-5 h-5 text-sky-500" />,
          colorTheme: 'from-sky-500/10 to-blue-500/5 border-sky-500/20 dark:border-sky-500/30'
        };
      case 'timeout':
        return {
          title: 'Network Timeout',
          icon: <Clock className="w-5 h-5 text-orange-500" />,
          colorTheme: 'from-orange-500/10 to-amber-500/5 border-orange-500/20 dark:border-orange-500/30'
        };
      case 'non-json':
        return {
          title: 'Unexpected Response Format',
          icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
          colorTheme: 'from-yellow-500/10 to-orange-500/5 border-yellow-500/20 dark:border-yellow-500/30',
          showPreview: true
        };
      default:
        return {
          title: 'Connection Issue',
          icon: <HelpCircle className="w-5 h-5 text-slate-500" />,
          colorTheme: 'from-slate-500/10 to-zinc-500/5 border-slate-500/20 dark:border-slate-500/30'
        };
    }
  };

  const config = getErrorConfig();

  // Extract a preview of raw text if we want to show it
  const getRawTextPreview = () => {
    if (!rawText) return null;
    const clean = rawText.trim();
    if (clean.length > 250) {
      return clean.substring(0, 250) + '...';
    }
    return clean;
  };

  const previewText = getRawTextPreview();

  const renderMediaPreview = () => {
    if (!isMedia || !mediaUrl) return null;

    switch (mediaType) {
      case 'image':
        return (
          <div className="mt-2.5 relative border border-slate-200/50 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-sm bg-slate-950/5 dark:bg-slate-950/40 flex flex-col items-center justify-center p-3">
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-slate-900/65 backdrop-blur-md text-[10px] font-mono text-white/90 uppercase tracking-widest font-semibold flex items-center gap-1 shadow-sm">
              <span>Image</span>
              <span className="opacity-60">•</span>
              <span>{formatBytes(fileSize)}</span>
            </div>
            {/* Checkerboard bg pattern for trans images */}
            <div className="relative max-w-full max-h-72 rounded-lg overflow-hidden border border-slate-200/20 shadow-md bg-[radial-gradient(#ccc_1px,transparent_1px)] dark:bg-[radial-gradient(#222_1px,transparent_1px)] [background-size:16px_16px] bg-white dark:bg-slate-900 p-4 shrink-0 flex items-center justify-center">
              <img
                src={mediaUrl}
                alt="API Media Preview"
                className="max-h-56 object-contain rounded select-none shadow-sm transition-transform hover:scale-[1.02] duration-300 pointer-events-auto"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-550 dark:text-slate-400 font-mono">
              <span className="truncate max-w-[200px]">{contentType}</span>
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="mt-2.5 relative border border-slate-200/50 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-sm bg-slate-950/5 dark:bg-slate-950/40 flex flex-col p-3 gap-2">
            <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded bg-slate-900/65 backdrop-blur-md text-[10px] font-mono text-white/90 uppercase tracking-widest font-semibold flex items-center gap-1 shadow-sm">
              <span>Video</span>
              <span className="opacity-60">•</span>
              <span>{formatBytes(fileSize)}</span>
            </div>
            <div className="w-full h-56 bg-slate-950 rounded-lg overflow-hidden relative shadow flex items-center justify-center">
              <video
                src={mediaUrl}
                controls
                className="w-full h-full max-h-full object-contain"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-550 dark:text-slate-400 font-mono">
              <span className="truncate max-w-[200px]">{contentType}</span>
            </div>
          </div>
        );

      case 'audio':
        return (
          <div className="mt-2.5 relative border border-slate-200/50 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-sm bg-slate-950/5 dark:bg-slate-950/40 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 uppercase text-[9px] tracking-wider font-semibold">Audio Stream</span>
                <span>{formatBytes(fileSize)}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 truncate max-w-[150px]">{contentType}</span>
            </div>
            <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200/65 dark:border-slate-800 p-2 text-slate-850 dark:text-slate-150 rounded-lg shadow-sm">
              <audio
                src={mediaUrl}
                controls
                className="w-full outline-none focus:outline-none"
              />
            </div>
          </div>
        );

      case 'pdf':
        return (
          <div className="mt-2.5 relative border border-slate-200/50 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-sm bg-slate-950/5 dark:bg-slate-950/40 p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 uppercase text-[9px] tracking-wider font-semibold">PDF Document</span>
                <span>{formatBytes(fileSize)}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 truncate max-w-[150px]">{contentType}</span>
            </div>
            <div className="h-64 border border-slate-200/60 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg overflow-hidden flex flex-col">
              <iframe
                src={mediaUrl}
                title="PDF Preview"
                className="w-full flex-1 border-0"
              />
            </div>
            <div className="flex justify-end gap-2">
              <a
                href={mediaUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-850 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold uppercase tracking-wider transition shadow-sm"
              >
                <ExternalLink size={11} />
                <span>Open in New Tab</span>
              </a>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`p-4 rounded-xl border bg-gradient-to-br ${config.colorTheme} shadow-sm text-slate-800 dark:text-slate-200 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300`}>
      <div className="flex items-start gap-3">
        <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200/50 dark:border-slate-800/80 flex items-center justify-center shrink-0">
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 leading-snug">
            {config.title}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
            {isMedia 
              ? `Succesfully retrieved actual media content (${contentType || mediaType}). Since this response cannot be serialized into graph nodes, we have prepared an interactive preview:` 
              : errorMessage}
          </p>
        </div>
      </div>

      {/* Render the interactive media preview panel */}
      {isMedia && renderMediaPreview()}

      {/* Optional Payload Preview for JSON/HTML parse issues */}
      {!isMedia && config.showPreview && previewText && (
        <div className="mt-1 bg-slate-950/5 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-800/40 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            <Terminal size={11} />
            <span>Response Preview</span>
          </div>
          <pre className="text-[11px] font-mono whitespace-pre-wrap break-all leading-normal text-slate-700 dark:text-slate-300 max-h-24 overflow-y-auto">
            {previewText}
          </pre>
        </div>
      )}

      {/* Advanced Collapsible Details */}
      <div className="border-t border-slate-200/40 dark:border-slate-800/40 pt-2 flex flex-col gap-1.5">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 font-semibold uppercase tracking-wider select-none outline-none focus:outline-none w-fit"
        >
          {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          <span>{showDetails ? 'Hide' : 'Show'} Technical Details</span>
        </button>

        {showDetails && (
          <div className="bg-slate-100 dark:bg-slate-950/20 rounded-lg p-2.5 font-mono text-[10px] leading-relaxed border border-slate-200/25 dark:border-slate-800/10 flex flex-col gap-1">
            <div className="flex justify-between border-b border-slate-200/20 dark:border-slate-800/30 pb-1">
              <span className="text-slate-550 dark:text-slate-500">Status:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-300">{status || '200'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/20 dark:border-slate-800/30 pb-1">
              <span className="text-slate-550 dark:text-slate-500">Source:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-300">
                {source === 'fallback' ? 'Cloudflare Worker Proxy' : source === 'native' ? 'Native Browser Fetch' : 'Pre-flight check'}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200/20 dark:border-slate-800/30 pb-1">
              <span className="text-slate-550 dark:text-slate-500">Phase:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-300">
                {phase === 'fallback-fetch' ? 'Fallback Fetch' 
                  : phase === 'native-fetch' ? 'Native Fetch' 
                  : phase === 'json-parse' ? 'JSON Parsing' 
                  : 'Initialization'}
              </span>
            </div>
            {contentType && (
              <div className="flex justify-between border-b border-slate-200/20 dark:border-slate-800/30 pb-1">
                <span className="text-slate-550 dark:text-slate-500">Content Type:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-300">{contentType}</span>
              </div>
            )}
            {reason && (
              <div className="flex flex-col gap-0.5 pt-1">
                <span className="text-slate-550 dark:text-slate-500">Reason:</span>
                <span className="text-[10px] leading-normal text-slate-700 dark:text-slate-400 whitespace-pre-wrap break-words italic">
                  {reason}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 items-center mt-1">
        {isMedia && mediaUrl && (
          <a
            href={mediaUrl}
            download={`downloaded_media_${Date.now()}.${mediaType === 'pdf' ? 'pdf' : mediaType === 'audio' ? 'mp3' : mediaType === 'video' ? 'mp4' : 'png'}`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/45 text-emerald-600 dark:text-emerald-450 border border-emerald-200/50 dark:border-emerald-550/20 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
          >
            <Download size={12} />
            <span>Save Local File</span>
          </a>
        )}
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/20 dark:hover:bg-blue-950/45 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-550/20 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
        >
          <RefreshCw size={12} className="shrink-0" />
          <span>{isMedia ? 'Refetch' : 'Retry Connection'}</span>
        </button>
      </div>
    </div>
  );
}
