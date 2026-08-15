import Dexie, { type EntityTable } from 'dexie';

export interface SavedDocument {
  id: number;
  name: string;
  code: string;
  createdAt: number;
  updatedAt: number;
  isPinned?: boolean;
}

export interface NodePosition {
  id: string; // The node ID/path
  x: number;
  y: number;
}

export interface CustomFormula {
  id?: number;
  name: string;
  description?: string;
  expr: string;
  type?: string;
  createdAt: number;
  isFavorite?: boolean;
  sortOrder?: number;
}

export interface Asset {
  assetId: string;
  thumbnailId?: string;
  hash?: string;
  filename?: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  data: ArrayBuffer | Blob;
  createdAt: number;
}

export interface Artboard {
  id: string;
  documentId: string;
  name: string;
  width: number;
  height: number;
  fill: string;
  order: number;
  data: any; // Extra artboard data
}

export interface FabricObject {
  id: string;
  documentId: string;
  artboardId: string;
  layerId?: string;
  type: string;
  data: any; // Serialized fabric object state
  relativeX: number;
  relativeY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  order?: number;
}

export interface Layer {
  id: string;
  documentId: string;
  artboardId: string;
  order: number;
}

export interface HistoryRecord {
  id?: number;
  documentId: string;
  timestamp: number;
  action: string;
  data: any;
}

export interface SearchHistoryRecord {
  id?: number;
  query: string;
  timestamp: number;
  isPinned?: boolean;
}

export interface SavedSearchArticle {
  id: string; // pageid or title
  title: string;
  summary: string;
  thumbnail?: string;
  timestamp: number;
}

// New storage-key based tables
export interface NodeSearchHistory {
  id?: number;
  storageKey: string;
  query: string;
  timestamp: number;
  isPinned?: boolean;
}

export interface NodeSearchBookmark {
  id?: number;
  storageKey: string;
  title: string;
  summary: string;
  thumbnail?: string;
  timestamp: number;
  collectionId?: string; // Maps to global collections later
  articleHtml?: string; // offline reading content
  aiNotes?: string; // research notes 
}

export interface NodeSearchCollection {
  id?: number;
  storageKey: string;
  name: string;
  timestamp: number;
}

export interface NodeSearchSettings {
  storageKey: string;
  language?: string;
  theme?: string;
  // any other preferences
}

export interface NodeSearchImageBookmark {
  id?: number;
  storageKey: string;
  imageUrl: string;
  thumbnail: string;
  title: string;
  source: string;
  searchQuery: string;
  timestamp: number;
}

export interface AudioTrack {
  id: string;
  title: string;
  duration?: number;
  source: string;
  type: string;
  thumbnail?: string;
  createdAt: number;
}

export interface StickyNote {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  fontFamily?: string;
  fontSize?: number;
  isMinimized: boolean;
  isMaximized?: boolean;
  zIndex?: number;
  isFavorite?: boolean;
  order?: number;
  createdAt: number;
  updatedAt: number;
}

export interface StickyNoteMedia {
  id: string;
  noteId: string;
  mimeType: string;
  data: Blob;
  createdAt: number;
}

export interface SharedFileRecord {
  id: string;
  files?: File[] | Blob[];
  title?: string;
  text?: string;
  link?: string;
  timestamp: number;
}

const db = new Dexie('JSONGraphViewerDB') as Dexie & {
  documents: EntityTable<SavedDocument, 'id'>;
  nodePositions: EntityTable<NodePosition, 'id'>;
  customFormulas: EntityTable<CustomFormula, 'id'>;
  assets: EntityTable<Asset, 'assetId'>;
  artboards: EntityTable<Artboard, 'id'>;
  objects: EntityTable<FabricObject, 'id'>;
  layers: EntityTable<Layer, 'id'>;
  history: EntityTable<HistoryRecord, 'id'>;
  searchHistory: EntityTable<SearchHistoryRecord, 'id'>;
  savedArticles: EntityTable<SavedSearchArticle, 'id'>;
  nodeSearchHistory: EntityTable<NodeSearchHistory, 'id'>;
  nodeSearchBookmarks: EntityTable<NodeSearchBookmark, 'id'>;
  nodeSearchCollections: EntityTable<NodeSearchCollection, 'id'>;
  nodeSearchSettings: EntityTable<NodeSearchSettings, 'storageKey'>;
  nodeSearchImageBookmarks: EntityTable<NodeSearchImageBookmark, 'id'>;
  audio_tracks: EntityTable<AudioTrack, 'id'>;
  stickyNotes: EntityTable<StickyNote, 'id'>;
  stickyNoteMedia: EntityTable<StickyNoteMedia, 'id'>;
  sharedFiles: EntityTable<SharedFileRecord, 'id'>;
};

db.version(8).stores({
  documents: '++id, name, createdAt, updatedAt, isPinned',
  nodePositions: 'id',
  customFormulas: '++id, name, createdAt',
  assets: 'assetId, hash, createdAt, thumbnailId',
  artboards: 'id, documentId, name, order',
  objects: 'id, documentId, artboardId, layerId, type',
  layers: 'id, documentId, artboardId, order',
  history: '++id, documentId, timestamp'
});

db.version(9).stores({
  searchHistory: '++id, query, timestamp, isPinned',
  savedArticles: 'id, title, timestamp'
});

db.version(10).stores({
  nodeSearchHistory: '++id, storageKey, query, timestamp, isPinned',
  nodeSearchBookmarks: '++id, storageKey, collectionId, title, timestamp',
  nodeSearchCollections: '++id, storageKey, name, timestamp',
  nodeSearchSettings: 'storageKey'
});

db.version(11).stores({
  nodeSearchHistory: '++id, storageKey, query, timestamp, isPinned',
  nodeSearchBookmarks: '++id, storageKey, collectionId, title, timestamp',
  nodeSearchCollections: '++id, storageKey, name, timestamp',
  nodeSearchSettings: 'storageKey',
  nodeSearchImageBookmarks: '++id, storageKey, imageUrl, title, searchQuery, timestamp'
});

db.version(12).stores({
  audio_tracks: 'id, title, source, type, createdAt'
});

db.version(14).stores({
  stickyNotes: 'id, createdAt, updatedAt'
});

db.version(15).stores({
  stickyNoteMedia: 'id, noteId'
});

db.version(16).stores({
  sharedFiles: 'id, timestamp'
});

export { db };

