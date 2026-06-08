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

const db = new Dexie('JSONGraphViewerDB') as Dexie & {
  documents: EntityTable<SavedDocument, 'id'>;
  nodePositions: EntityTable<NodePosition, 'id'>;
  customFormulas: EntityTable<CustomFormula, 'id'>;
};

db.version(3).stores({
  documents: '++id, name, createdAt, updatedAt',
  nodePositions: 'id', // Primary key is id, no auto-increment
  customFormulas: '++id, name, createdAt'
}).upgrade(tx => {
  // Upgrade handling automatically managed by Dexie for new tables
});

export { db };

