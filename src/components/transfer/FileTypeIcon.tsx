import React from 'react';
import {
  File as FileIcon,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileArchive,
  FileCode,
  Music,
  Film,
  Image as ImageIcon,
  Box,
  Package,
  Type,
  Database,
  type LucideIcon,
} from 'lucide-react';

export type FileFamily =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'doc'
  | 'sheet'
  | 'slides'
  | 'archive'
  | 'code'
  | 'text'
  | 'model'
  | 'data'
  | 'font'
  | 'app'
  | 'other';

const BY_EXT: Record<string, FileFamily> = {};
const add = (family: FileFamily, exts: string) => exts.split(' ').forEach((e) => (BY_EXT[e] = family));
add('image', 'png jpg jpeg gif webp avif bmp svg ico heic heif tif tiff');
add('video', 'mp4 webm mov m4v mkv avi ogv 3gp');
add('audio', 'mp3 wav ogg oga m4a aac flac opus amr weba');
add('pdf', 'pdf');
add('doc', 'doc docx odt rtf pages');
add('sheet', 'xls xlsx ods csv tsv numbers');
add('slides', 'ppt pptx odp key');
add('archive', 'zip rar 7z tar gz tgz bz2 xz');
add('code', 'js mjs cjs ts tsx jsx py java c cpp h cs go rs rb php swift kt html htm css scss json xml yaml yml toml sh bat ps1 ipynb');
add('text', 'txt md log ini cfg');
add('model', 'glb gltf obj stl fbx usdz ply 3ds');
add('data', 'sql sqlite sqlite3 db');
add('font', 'ttf otf woff woff2');
add('app', 'apk exe msi dmg deb rpm appimage');

export function fileFamily(name: string, mime = ''): FileFamily {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (BY_EXT[ext]) return BY_EXT[ext];
  const m = mime.toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('text/')) return 'text';
  if (m.includes('zip') || m.includes('compressed')) return 'archive';
  return 'other';
}

const STYLE: Record<FileFamily, { Icon: LucideIcon; tone: string }> = {
  image: { Icon: ImageIcon, tone: 'text-emerald-400 bg-emerald-500/12' },
  video: { Icon: Film, tone: 'text-sky-400 bg-sky-500/12' },
  audio: { Icon: Music, tone: 'text-violet-400 bg-violet-500/12' },
  pdf: { Icon: FileText, tone: 'text-red-400 bg-red-500/12' },
  doc: { Icon: FileText, tone: 'text-blue-400 bg-blue-500/12' },
  sheet: { Icon: FileSpreadsheet, tone: 'text-green-400 bg-green-500/12' },
  slides: { Icon: Presentation, tone: 'text-orange-400 bg-orange-500/12' },
  archive: { Icon: FileArchive, tone: 'text-amber-400 bg-amber-500/12' },
  code: { Icon: FileCode, tone: 'text-cyan-400 bg-cyan-500/12' },
  text: { Icon: FileText, tone: 'text-slate-300 bg-slate-500/15' },
  model: { Icon: Box, tone: 'text-teal-400 bg-teal-500/12' },
  data: { Icon: Database, tone: 'text-indigo-400 bg-indigo-500/12' },
  font: { Icon: Type, tone: 'text-pink-400 bg-pink-500/12' },
  app: { Icon: Package, tone: 'text-lime-400 bg-lime-500/12' },
  other: { Icon: FileIcon, tone: 'text-slate-400 bg-slate-500/15' },
};

/** The short label shown on a tile: the file's extension, or the family. */
export const extLabel = (name: string) => {
  const ext = name.includes('.') ? name.split('.').pop()!.toUpperCase() : '';
  return ext.length && ext.length <= 5 ? ext : '';
};

/**
 * A coloured icon for a file's type (PDF red, audio violet, sheet green…), with its extension
 * underneath when `label` is set. Fills its parent when `fill`.
 */
export function FileTypeIcon({
  name,
  mime,
  size = 18,
  label = false,
  fill = false,
  className = '',
}: {
  name: string;
  mime?: string;
  size?: number;
  label?: boolean;
  fill?: boolean;
  className?: string;
}) {
  const { Icon, tone } = STYLE[fileFamily(name, mime)];
  const ext = label ? extLabel(name) : '';
  return (
    <div className={`${fill ? 'absolute inset-0' : ''} flex flex-col items-center justify-center gap-1 ${tone} ${className}`}>
      <Icon size={size} strokeWidth={1.75} />
      {ext && <span className="text-[9px] font-bold tracking-wide leading-none">{ext}</span>}
    </div>
  );
}
