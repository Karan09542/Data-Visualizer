import Dexie, { type EntityTable } from 'dexie';

export interface SavedDocument {
  id: number;
  name: string;
  code: string;
  createdAt: number;
  updatedAt: number;
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

const db = new Dexie('JSONGraphViewerDB') as Dexie & {
  documents: EntityTable<SavedDocument, 'id'>;
  nodePositions: EntityTable<NodePosition, 'id'>;
  customFormulas: EntityTable<CustomFormula, 'id'>;
  assets: EntityTable<Asset, 'assetId'>;
  artboards: EntityTable<Artboard, 'id'>;
  objects: EntityTable<FabricObject, 'id'>;
  layers: EntityTable<Layer, 'id'>;
  history: EntityTable<HistoryRecord, 'id'>;
};

db.version(7).stores({
  documents: '++id, name, createdAt, updatedAt',
  nodePositions: 'id',
  customFormulas: '++id, name, createdAt',
  assets: 'assetId, hash, createdAt, thumbnailId',
  artboards: 'id, documentId, name, order',
  objects: 'id, documentId, artboardId, layerId, type',
  layers: 'id, documentId, artboardId, order',
  history: '++id, documentId, timestamp'
});

export { db };

