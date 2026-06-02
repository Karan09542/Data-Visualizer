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

const db = new Dexie('JSONGraphViewerDB') as Dexie & {
  documents: EntityTable<SavedDocument, 'id'>;
  nodePositions: EntityTable<NodePosition, 'id'>;
};

db.version(2).stores({
  documents: '++id, name, createdAt, updatedAt',
  nodePositions: 'id' // Primary key is id, no auto-increment
}).upgrade(tx => {
  // Upgrade handling automatically managed by Dexie for new tables
});

export { db };

