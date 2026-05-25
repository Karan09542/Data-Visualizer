import Dexie, { type EntityTable } from 'dexie';

export interface SavedDocument {
  id: number;
  name: string;
  code: string;
  createdAt: number;
  updatedAt: number;
}

const db = new Dexie('JSONGraphViewerDB') as Dexie & {
  documents: EntityTable<
    SavedDocument,
    'id'
  >;
};

db.version(1).stores({
  documents: '++id, name, createdAt, updatedAt'
});

export { db };
