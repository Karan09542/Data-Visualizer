import initSqlJsModule, { type SqlJsStatic } from 'sql.js';
import {
  db,
  type SavedDocument,
  type StickyNote,
  type CustomFormula,
  type NodePosition,
  type SavedMathScene,
  type Asset,
  type StickyNoteMedia,
} from '../lib/db';
import {
  readAssetBytes,
  mediaFiles,
  collectReferencedAssetIds,
  revokeAllUrls,
} from './assetManager';
import { useStore } from '../store/useStore';

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

/**
 * Initializes and caches the SQL.js WebAssembly instance.
 */
export async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    const init = (typeof initSqlJsModule === 'function'
      ? initSqlJsModule
      : (initSqlJsModule as any)?.default || initSqlJsModule) as (config?: any) => Promise<SqlJsStatic>;

    sqlJsPromise = init({
      locateFile: (_file: string) => `/sql-wasm.wasm`,
    });
  }
  return sqlJsPromise;
}

/**
 * Checks if a byte buffer starts with the standard SQLite 3 file header magic bytes:
 * "SQLite format 3\0"
 */
export function isSqliteBinary(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 16) return false;
  const magic = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00];
  for (let i = 0; i < 16; i++) {
    if (bytes[i] !== magic[i]) return false;
  }
  return true;
}

export interface WorkspaceSqliteMeta {
  version?: string | undefined;
  app?: string | undefined;
  exportedAt?: number | undefined;
  activeDocumentName?: string | undefined;
  documentCount?: number | undefined;
  description?: string | undefined;
  assetCount?: number | undefined;
  totalMediaBytes?: number | undefined;
  [key: string]: any;
}

export interface SqliteWorkspaceAsset {
  assetId: string;
  thumbnailId?: string | undefined;
  hash?: string | undefined;
  filename?: string | undefined;
  mimeType: string;
  size: number;
  width?: number | undefined;
  height?: number | undefined;
  createdAt: number;
  data: Uint8Array;
}

export interface ExportableAsset {
  asset: Asset;
  data: Uint8Array;
}

export interface ParsedSqliteWorkspace {
  documents: Array<{
    id?: number | undefined;
    name: string;
    code: string;
    createdAt: number;
    updatedAt: number;
    isPinned?: boolean | undefined;
  }>;
  meta: WorkspaceSqliteMeta;
  assets?: SqliteWorkspaceAsset[] | undefined;
  extraTables?: {
    stickyNotes?: StickyNote[] | undefined;
    customFormulas?: CustomFormula[] | undefined;
    nodePositions?: NodePosition[] | undefined;
    mathScenes?: SavedMathScene[] | undefined;
    stickyNoteMedia?: StickyNoteMedia[] | undefined;
    genericTables?: Array<{
      tableName: string;
      columns: string[];
      rowCount: number;
      sampleData: Record<string, any>[];
    }> | undefined;
  } | undefined;
}

/**
 * Resolves all media assets referenced across documents (or all workspace assets),
 * reading their binary bytes from device storage (OPFS / IndexedDB).
 */
export async function getAssetsForDocuments(
  documents: Array<{ code?: string }>,
  allWorkspace = false
): Promise<ExportableAsset[]> {
  const exportAssets: ExportableAsset[] = [];
  const processedAssetIds = new Set<string>();

  // If allWorkspace, load all assets from db.assets
  if (allWorkspace) {
    try {
      const allAssets = await db.assets.toArray();
      for (const asset of allAssets) {
        if (processedAssetIds.has(asset.assetId)) continue;
        processedAssetIds.add(asset.assetId);

        const data = await readAssetBytes(asset);
        exportAssets.push({
          asset,
          data: data || new Uint8Array(0),
        });
      }
    } catch (err) {
      console.warn('Failed to load all workspace assets:', err);
    }
    return exportAssets;
  }

  // Otherwise, find referenced asset IDs in the documents
  const referencedIds = new Set<string>();
  const assetRegex = /(?:img|thumb)_[A-Za-z0-9]+(?:\.[A-Za-z0-9]{1,5})?/g;

  for (const doc of documents) {
    if (!doc.code) continue;

    // 1. Regex scan for asset IDs (works on JSON, YAML, plain text)
    let match: RegExpExecArray | null;
    const code = doc.code;
    while ((match = assetRegex.exec(code)) !== null) {
      if (match[0]) referencedIds.add(match[0]);
    }

    // 2. Structured JSON scan if valid JSON
    try {
      const parsed = JSON.parse(code);
      const jsonIds = collectReferencedAssetIds(parsed);
      jsonIds.forEach((id) => referencedIds.add(id));
    } catch {}
  }

  // Also include associated thumbnails and originals
  for (const id of Array.from(referencedIds)) {
    if (processedAssetIds.has(id)) continue;
    processedAssetIds.add(id);

    try {
      const asset = await db.assets.get(id);
      if (asset) {
        const data = await readAssetBytes(asset);
        exportAssets.push({
          asset,
          data: data || new Uint8Array(0),
        });

        // If it has a thumbnailId, also export the thumbnail
        if (asset.thumbnailId && !processedAssetIds.has(asset.thumbnailId)) {
          processedAssetIds.add(asset.thumbnailId);
          const thumb = await db.assets.get(asset.thumbnailId);
          if (thumb) {
            const thumbData = await readAssetBytes(thumb);
            exportAssets.push({
              asset: thumb,
              data: thumbData || new Uint8Array(0),
            });
          }
        }
      } else if (id.startsWith('thumb_')) {
        const orig = await db.assets.where('thumbnailId').equals(id).first();
        if (orig && !processedAssetIds.has(orig.assetId)) {
          processedAssetIds.add(orig.assetId);
          const origData = await readAssetBytes(orig);
          exportAssets.push({
            asset: orig,
            data: origData || new Uint8Array(0),
          });
        }
      }
    } catch (err) {
      console.warn(`Error resolving asset ${id} for export:`, err);
    }
  }

  return exportAssets;
}

/**
 * Deserializes and restores assets from SQLite binary into the app's asset storage
 * (OPFS / db.assetFiles) and registers them with Dexie db.assets and useStore.
 */
export async function restoreSqliteAssets(assets: SqliteWorkspaceAsset[]): Promise<number> {
  if (!assets || assets.length === 0) return 0;

  let restoredCount = 0;
  for (const asset of assets) {
    try {
      const storageKey = `asset://${asset.assetId}`;

      // 1. Write the binary data to device storage (OPFS or db.assetFiles)
      if (asset.data && asset.data.length > 0) {
        const buffer = asset.data.buffer.slice(
          asset.data.byteOffset,
          asset.data.byteOffset + asset.data.byteLength
        ) as ArrayBuffer;
        await mediaFiles.write(storageKey, buffer);
      }

      // 2. Put record in db.assets safely matching optional types
      const assetRecord: Asset = {
        assetId: asset.assetId,
        mimeType: asset.mimeType,
        size: asset.size || (asset.data ? asset.data.length : 0),
        storageKey,
        createdAt: asset.createdAt || Date.now(),
      };
      if (asset.thumbnailId !== undefined) assetRecord.thumbnailId = asset.thumbnailId;
      if (asset.hash !== undefined) assetRecord.hash = asset.hash;
      if (asset.filename !== undefined) assetRecord.filename = asset.filename;
      if (asset.width !== undefined) assetRecord.width = asset.width;
      if (asset.height !== undefined) assetRecord.height = asset.height;

      await db.assets.put(assetRecord);

      // 3. Register metadata in store
      useStore.getState().registerMediaMetadata(asset.assetId, {
        filename: asset.filename || asset.assetId,
        mimeType: asset.mimeType,
        size: asset.size || (asset.data ? asset.data.length : 0),
      });

      restoredCount++;
    } catch (err) {
      console.warn(`Failed to restore asset ${asset.assetId}:`, err);
    }
  }

  // Revoke cached URLs so UI components immediately query fresh Object URLs
  revokeAllUrls();

  return restoredCount;
}

/**
 * Exports an array of documents (and optional extra workspace items and multimedia assets)
 * to a SQLite binary database (Uint8Array).
 */
export async function exportDocumentsToSqliteBinary(
  documents: Array<{
    id?: number | undefined;
    name: string;
    code: string;
    createdAt?: number | undefined;
    updatedAt?: number | undefined;
    isPinned?: boolean | undefined;
  }>,
  meta: WorkspaceSqliteMeta = {},
  extras?: {
    stickyNotes?: StickyNote[] | undefined;
    customFormulas?: CustomFormula[] | undefined;
    nodePositions?: NodePosition[] | undefined;
    mathScenes?: SavedMathScene[] | undefined;
    stickyNoteMedia?: StickyNoteMedia[] | undefined;
    assets?: ExportableAsset[] | undefined;
    includeAllAssets?: boolean | undefined;
  } | undefined
): Promise<Uint8Array> {
  const SQL = await getSqlJs();
  const sqlite = new SQL.Database();

  try {
    // 1. Multimedia Assets table (Images, Videos, Audio, PDFs, 3D Models)
    // Gather assets automatically if not explicitly provided
    const assetsToExport =
      extras?.assets ??
      (await getAssetsForDocuments(
        documents,
        extras?.includeAllAssets ?? (meta.documentCount === undefined || documents.length > 1)
      ));

    const totalMediaBytes = assetsToExport.reduce((acc, curr) => acc + (curr.data ? curr.data.length : 0), 0);

    // 2. Workspace metadata table
    sqlite.run(`CREATE TABLE IF NOT EXISTS workspace_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );`);

    const metaStmt = sqlite.prepare(`INSERT OR REPLACE INTO workspace_meta (key, value) VALUES (?, ?)`);
    const defaultMeta: WorkspaceSqliteMeta = {
      version: '1.1.0',
      app: 'JSON/YAML Visualizer',
      exportedAt: Date.now(),
      documentCount: documents.length,
      assetCount: assetsToExport.length,
      totalMediaBytes,
      ...meta,
    };
    for (const [k, v] of Object.entries(defaultMeta)) {
      if (v !== undefined) {
        metaStmt.run([k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
      }
    }
    metaStmt.free();

    // 3. Documents table
    sqlite.run(`CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER,
      is_pinned INTEGER DEFAULT 0
    );`);

    const docStmt = sqlite.prepare(
      `INSERT INTO documents (id, name, code, created_at, updated_at, is_pinned) VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const doc of documents) {
      docStmt.run([
        doc.id ?? null,
        doc.name || 'Untitled Document',
        doc.code ?? '',
        doc.createdAt ?? Date.now(),
        doc.updatedAt ?? Date.now(),
        doc.isPinned ? 1 : 0,
      ]);
    }
    docStmt.free();

    // 4. Save Assets table as SQLite BLOBs
    if (assetsToExport.length > 0) {
      sqlite.run(`CREATE TABLE IF NOT EXISTS assets (
        asset_id TEXT PRIMARY KEY,
        thumbnail_id TEXT,
        hash TEXT,
        filename TEXT,
        mime_type TEXT,
        size INTEGER,
        width INTEGER,
        height INTEGER,
        created_at INTEGER,
        data BLOB
      );`);

      const assetStmt = sqlite.prepare(
        `INSERT OR REPLACE INTO assets (asset_id, thumbnail_id, hash, filename, mime_type, size, width, height, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const { asset, data } of assetsToExport) {
        assetStmt.run([
          asset.assetId,
          asset.thumbnailId || null,
          asset.hash || null,
          asset.filename || null,
          asset.mimeType || 'application/octet-stream',
          asset.size || (data ? data.length : 0),
          asset.width ?? null,
          asset.height ?? null,
          asset.createdAt || Date.now(),
          data && data.length > 0 ? data : null,
        ]);
      }
      assetStmt.free();
    }

    // 5. Optional Extra Tables
    if (extras?.stickyNotes && extras.stickyNotes.length > 0) {
      sqlite.run(`CREATE TABLE IF NOT EXISTS sticky_notes (
        id TEXT PRIMARY KEY,
        content TEXT,
        x REAL,
        y REAL,
        width REAL,
        height REAL,
        color TEXT,
        font_family TEXT,
        font_size REAL,
        is_minimized INTEGER,
        is_maximized INTEGER,
        is_read_only INTEGER,
        z_index INTEGER,
        is_favorite INTEGER,
        sort_order INTEGER,
        created_at INTEGER,
        updated_at INTEGER
      );`);
      const noteStmt = sqlite.prepare(
        `INSERT INTO sticky_notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const n of extras.stickyNotes) {
        noteStmt.run([
          n.id,
          n.content || '',
          n.x ?? 0,
          n.y ?? 0,
          n.width ?? 200,
          n.height ?? 200,
          n.color || '#fef08a',
          n.fontFamily || '',
          n.fontSize ?? 14,
          n.isMinimized ? 1 : 0,
          n.isMaximized ? 1 : 0,
          n.isReadOnly ? 1 : 0,
          n.zIndex ?? 1,
          n.isFavorite ? 1 : 0,
          n.order ?? 0,
          n.createdAt ?? Date.now(),
          n.updatedAt ?? Date.now(),
        ]);
      }
      noteStmt.free();
    }

    if (extras?.stickyNoteMedia && extras.stickyNoteMedia.length > 0) {
      sqlite.run(`CREATE TABLE IF NOT EXISTS sticky_note_media (
        id TEXT PRIMARY KEY,
        note_id TEXT,
        mime_type TEXT,
        created_at INTEGER,
        data BLOB
      );`);

      const smStmt = sqlite.prepare(
        `INSERT OR REPLACE INTO sticky_note_media VALUES (?, ?, ?, ?, ?)`
      );

      for (const m of extras.stickyNoteMedia) {
        let rawBytes: Uint8Array | null = null;
        if (m.data instanceof Blob) {
          rawBytes = new Uint8Array(await m.data.arrayBuffer());
        } else if (typeof (m as any).data === 'string') {
          rawBytes = new TextEncoder().encode((m as any).data);
        } else if ((m as any).data instanceof Uint8Array) {
          rawBytes = (m as any).data;
        }
        smStmt.run([
          m.id,
          m.noteId,
          m.mimeType || 'application/octet-stream',
          m.createdAt || Date.now(),
          rawBytes,
        ]);
      }
      smStmt.free();
    }

    if (extras?.customFormulas && extras.customFormulas.length > 0) {
      sqlite.run(`CREATE TABLE IF NOT EXISTS custom_formulas (
        id INTEGER PRIMARY KEY,
        name TEXT,
        description TEXT,
        expr TEXT,
        type TEXT,
        created_at INTEGER,
        is_favorite INTEGER,
        sort_order INTEGER
      );`);
      const formStmt = sqlite.prepare(`INSERT INTO custom_formulas VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const f of extras.customFormulas) {
        formStmt.run([
          f.id ?? null,
          f.name,
          f.description || '',
          f.expr,
          f.type || '',
          f.createdAt ?? Date.now(),
          f.isFavorite ? 1 : 0,
          f.sortOrder ?? 0,
        ]);
      }
      formStmt.free();
    }

    if (extras?.nodePositions && extras.nodePositions.length > 0) {
      sqlite.run(`CREATE TABLE IF NOT EXISTS node_positions (
        id TEXT PRIMARY KEY,
        x REAL,
        y REAL
      );`);
      const posStmt = sqlite.prepare(`INSERT INTO node_positions VALUES (?, ?, ?)`);
      for (const p of extras.nodePositions) {
        posStmt.run([p.id, p.x, p.y]);
      }
      posStmt.free();
    }

    if (extras?.mathScenes && extras.mathScenes.length > 0) {
      sqlite.run(`CREATE TABLE IF NOT EXISTS math_scenes (
        id INTEGER PRIMARY KEY,
        name TEXT,
        description TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        scene_json TEXT
      );`);
      const sceneStmt = sqlite.prepare(`INSERT INTO math_scenes VALUES (?, ?, ?, ?, ?, ?)`);
      for (const s of extras.mathScenes) {
        sceneStmt.run([
          s.id ?? null,
          s.name,
          s.description || '',
          s.createdAt ?? Date.now(),
          s.updatedAt ?? Date.now(),
          JSON.stringify(s.scene || {}),
        ]);
      }
      sceneStmt.free();
    }

    const exportedBytes = sqlite.export();
    return exportedBytes;
  } finally {
    sqlite.close();
  }
}

/**
 * Escapes text for SQL string literal
 */
function escapeSqlString(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

/**
 * Generates human-readable SQL statements (CREATE TABLE & INSERT INTO) for documents, workspace,
 * and multimedia assets (encoded as SQLite hex BLOB literals X'...').
 */
export async function exportDocumentsToSqlScript(
  documents: Array<{
    id?: number | undefined;
    name: string;
    code: string;
    createdAt?: number | undefined;
    updatedAt?: number | undefined;
    isPinned?: boolean | undefined;
  }>,
  meta: WorkspaceSqliteMeta = {},
  extras?: {
    assets?: ExportableAsset[] | undefined;
    includeAllAssets?: boolean | undefined;
  } | undefined
): Promise<string> {
  const assetsToExport =
    extras?.assets ??
    (await getAssetsForDocuments(
      documents,
      extras?.includeAllAssets ?? (meta.documentCount === undefined || documents.length > 1)
    ));

  const totalMediaBytes = assetsToExport.reduce((acc, curr) => acc + (curr.data ? curr.data.length : 0), 0);

  const lines: string[] = [
    '-- JSON / YAML Visualizer Workspace SQL Export',
    `-- Exported At: ${new Date().toISOString()}`,
    `-- Total Documents: ${documents.length}`,
    `-- Total Media Assets: ${assetsToExport.length} (${(totalMediaBytes / 1024).toFixed(1)} KB)`,
    '',
    'BEGIN TRANSACTION;',
    '',
    '-- Workspace Metadata',
    'CREATE TABLE IF NOT EXISTS workspace_meta (',
    '  key TEXT PRIMARY KEY,',
    '  value TEXT',
    ');',
    '',
  ];

  const defaultMeta: WorkspaceSqliteMeta = {
    version: '1.1.0',
    app: 'JSON/YAML Visualizer',
    exportedAt: Date.now(),
    documentCount: documents.length,
    assetCount: assetsToExport.length,
    totalMediaBytes,
    ...meta,
  };

  for (const [k, v] of Object.entries(defaultMeta)) {
    if (v !== undefined) {
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
      lines.push(
        `INSERT OR REPLACE INTO workspace_meta (key, value) VALUES (${escapeSqlString(k)}, ${escapeSqlString(val)});`
      );
    }
  }

  lines.push('');
  lines.push('-- Workspace Documents');
  lines.push('CREATE TABLE IF NOT EXISTS documents (');
  lines.push('  id INTEGER PRIMARY KEY,');
  lines.push('  name TEXT NOT NULL,');
  lines.push('  code TEXT NOT NULL,');
  lines.push('  created_at INTEGER,');
  lines.push('  updated_at INTEGER,');
  lines.push('  is_pinned INTEGER DEFAULT 0');
  lines.push(');');
  lines.push('');

  for (const doc of documents) {
    const idVal = doc.id != null ? doc.id : 'NULL';
    const nameVal = escapeSqlString(doc.name || 'Untitled Document');
    const codeVal = escapeSqlString(doc.code ?? '');
    const createdVal = doc.createdAt ?? Date.now();
    const updatedVal = doc.updatedAt ?? Date.now();
    const pinnedVal = doc.isPinned ? 1 : 0;

    lines.push(
      `INSERT INTO documents (id, name, code, created_at, updated_at, is_pinned) VALUES (${idVal}, ${nameVal}, ${codeVal}, ${createdVal}, ${updatedVal}, ${pinnedVal});`
    );
  }

  // Include Assets table if assets exist
  if (assetsToExport.length > 0) {
    lines.push('');
    lines.push('-- Workspace Multimedia Assets (Images, Videos, Audio, PDFs, 3D Models)');
    lines.push('CREATE TABLE IF NOT EXISTS assets (');
    lines.push('  asset_id TEXT PRIMARY KEY,');
    lines.push('  thumbnail_id TEXT,');
    lines.push('  hash TEXT,');
    lines.push('  filename TEXT,');
    lines.push('  mime_type TEXT,');
    lines.push('  size INTEGER,');
    lines.push('  width INTEGER,');
    lines.push('  height INTEGER,');
    lines.push('  created_at INTEGER,');
    lines.push('  data BLOB');
    lines.push(');');
    lines.push('');

    for (const { asset, data } of assetsToExport) {
      let hexBlob = 'NULL';
      if (data && data.length > 0) {
        let hex = '';
        for (let i = 0; i < data.length; i++) {
          hex += data[i].toString(16).padStart(2, '0');
        }
        hexBlob = `X'${hex}'`;
      }

      const idVal = escapeSqlString(asset.assetId);
      const thumbVal = asset.thumbnailId ? escapeSqlString(asset.thumbnailId) : 'NULL';
      const hashVal = asset.hash ? escapeSqlString(asset.hash) : 'NULL';
      const fnVal = asset.filename ? escapeSqlString(asset.filename) : 'NULL';
      const mimeVal = escapeSqlString(asset.mimeType || 'application/octet-stream');
      const sizeVal = asset.size || (data ? data.length : 0);
      const widthVal = asset.width != null ? asset.width : 'NULL';
      const heightVal = asset.height != null ? asset.height : 'NULL';
      const createdVal = asset.createdAt || Date.now();

      lines.push(
        `INSERT OR REPLACE INTO assets (asset_id, thumbnail_id, hash, filename, mime_type, size, width, height, created_at, data) VALUES (${idVal}, ${thumbVal}, ${hashVal}, ${fnVal}, ${mimeVal}, ${sizeVal}, ${widthVal}, ${heightVal}, ${createdVal}, ${hexBlob});`
      );
    }
  }

  lines.push('');
  lines.push('COMMIT;');
  lines.push('');

  return lines.join('\n');
}

/**
 * Parses a SQLite binary buffer (or ArrayBuffer) into structured workspace data,
 * extracting documents, metadata, multimedia assets, and layout tables.
 */
export async function parseSqliteWorkspace(buffer: ArrayBuffer | Uint8Array): Promise<ParsedSqliteWorkspace> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const SQL = await getSqlJs();
  const sqlite = new SQL.Database(bytes);

  try {
    const result: ParsedSqliteWorkspace = {
      documents: [],
      meta: {},
      assets: [],
      extraTables: {},
    };

    // Check available tables
    const tablesQuery = sqlite.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const availableTables = new Set<string>();
    const firstTablesQuery = tablesQuery[0];
    if (firstTablesQuery && firstTablesQuery.values) {
      for (const row of firstTablesQuery.values) {
        if (row && row[0]) availableTables.add(String(row[0]));
      }
    }

    // 1. Read workspace_meta if exists
    if (availableTables.has('workspace_meta')) {
      try {
        const metaRes = sqlite.exec('SELECT key, value FROM workspace_meta');
        const firstMetaRes = metaRes[0];
        if (firstMetaRes && firstMetaRes.values) {
          for (const row of firstMetaRes.values) {
            if (!row) continue;
            const k = row[0];
            const v = row[1];
            if (k) {
              const strVal = String(v ?? '');
              try {
                result.meta[String(k)] = JSON.parse(strVal);
              } catch {
                result.meta[String(k)] = strVal;
              }
            }
          }
        }
      } catch (err) {
        console.warn('Error reading workspace_meta:', err);
      }
    }

    // 2. Read documents table if exists
    if (availableTables.has('documents')) {
      try {
        const docRes = sqlite.exec('SELECT id, name, code, created_at, updated_at, is_pinned FROM documents');
        const firstDocRes = docRes[0];
        if (firstDocRes && firstDocRes.values) {
          for (const row of firstDocRes.values) {
            if (!row) continue;
            const docObj: {
              id?: number | undefined;
              name: string;
              code: string;
              createdAt: number;
              updatedAt: number;
              isPinned?: boolean | undefined;
            } = {
              name: String(row[1] || 'Document'),
              code: String(row[2] || ''),
              createdAt: typeof row[3] === 'number' ? row[3] : Date.now(),
              updatedAt: typeof row[4] === 'number' ? row[4] : Date.now(),
              isPinned: Boolean(row[5]),
            };
            if (typeof row[0] === 'number') {
              docObj.id = row[0];
            }
            result.documents.push(docObj);
          }
        }
      } catch (err) {
        console.warn('Error reading documents table:', err);
      }
    }

    // 3. Read assets table if exists (Images, Videos, Audio, PDFs, 3D Models)
    if (availableTables.has('assets')) {
      try {
        const assetRes = sqlite.exec(
          'SELECT asset_id, thumbnail_id, hash, filename, mime_type, size, width, height, created_at, data FROM assets'
        );
        const firstAssetRes = assetRes[0];
        if (firstAssetRes && firstAssetRes.values) {
          result.assets = firstAssetRes.values.map((row) => {
            const rawData = row ? row[9] : null;
            const dataBytes =
              rawData instanceof Uint8Array
                ? rawData
                : rawData
                  ? new Uint8Array(rawData as any)
                  : new Uint8Array(0);

            const assetItem: SqliteWorkspaceAsset = {
              assetId: String(row?.[0] || ''),
              mimeType: String(row?.[4] || 'application/octet-stream'),
              size: Number(row?.[5]) || dataBytes.length,
              createdAt: Number(row?.[8]) || Date.now(),
              data: dataBytes,
            };
            if (row?.[1]) assetItem.thumbnailId = String(row[1]);
            if (row?.[2]) assetItem.hash = String(row[2]);
            if (row?.[3]) assetItem.filename = String(row[3]);
            if (row?.[6] != null) assetItem.width = Number(row[6]);
            if (row?.[7] != null) assetItem.height = Number(row[7]);

            return assetItem;
          });
        }
      } catch (err) {
        console.warn('Error reading assets table from SQLite:', err);
      }
    }

    // 4. Read sticky_notes if exists
    if (availableTables.has('sticky_notes')) {
      try {
        const noteRes = sqlite.exec('SELECT * FROM sticky_notes');
        const firstNoteRes = noteRes[0];
        if (firstNoteRes && firstNoteRes.values) {
          const cols = firstNoteRes.columns;
          result.extraTables = result.extraTables || {};
          result.extraTables.stickyNotes = firstNoteRes.values.map((row) => {
            const obj: Record<string, any> = {};
            if (row) {
              cols.forEach((col, idx) => {
                obj[col] = row[idx];
              });
            }
            return {
              id: String(obj.id || crypto.randomUUID()),
              content: String(obj.content || ''),
              x: Number(obj.x) || 0,
              y: Number(obj.y) || 0,
              width: Number(obj.width) || 200,
              height: Number(obj.height) || 200,
              color: String(obj.color || '#fef08a'),
              fontFamily: obj.font_family,
              fontSize: Number(obj.font_size) || 14,
              isMinimized: Boolean(obj.is_minimized),
              isMaximized: Boolean(obj.is_maximized),
              isReadOnly: Boolean(obj.is_read_only),
              zIndex: Number(obj.z_index) || 1,
              isFavorite: Boolean(obj.is_favorite),
              order: Number(obj.sort_order) || 0,
              createdAt: Number(obj.created_at) || Date.now(),
              updatedAt: Number(obj.updated_at) || Date.now(),
            } as StickyNote;
          });
        }
      } catch (err) {
        console.warn('Error reading sticky_notes:', err);
      }
    }

    // 5. Read sticky_note_media if exists
    if (availableTables.has('sticky_note_media')) {
      try {
        const mediaRes = sqlite.exec('SELECT * FROM sticky_note_media');
        const firstMediaRes = mediaRes[0];
        if (firstMediaRes && firstMediaRes.values) {
          const cols = firstMediaRes.columns;
          result.extraTables = result.extraTables || {};
          result.extraTables.stickyNoteMedia = firstMediaRes.values.map((row) => {
            const obj: Record<string, any> = {};
            if (row) {
              cols.forEach((col, idx) => {
                obj[col] = row[idx];
              });
            }
            const dataBytes =
              obj.data instanceof Uint8Array
                ? obj.data
                : obj.data
                  ? new Uint8Array(obj.data)
                  : new Uint8Array(0);
            const blob = new Blob([dataBytes.buffer as ArrayBuffer], { type: obj.mime_type || 'application/octet-stream' });
            return {
              id: String(obj.id || crypto.randomUUID()),
              noteId: String(obj.note_id || ''),
              mimeType: String(obj.mime_type || 'application/octet-stream'),
              createdAt: Number(obj.created_at) || Date.now(),
              data: blob,
            } as StickyNoteMedia;
          });
        }
      } catch (err) {
        console.warn('Error reading sticky_note_media:', err);
      }
    }

    // 6. Read custom_formulas if exists
    if (availableTables.has('custom_formulas')) {
      try {
        const formRes = sqlite.exec('SELECT * FROM custom_formulas');
        const firstFormRes = formRes[0];
        if (firstFormRes && firstFormRes.values) {
          const cols = firstFormRes.columns;
          result.extraTables = result.extraTables || {};
          result.extraTables.customFormulas = firstFormRes.values.map((row) => {
            const obj: Record<string, any> = {};
            if (row) {
              cols.forEach((col, idx) => {
                obj[col] = row[idx];
              });
            }
            const formulaItem: CustomFormula = {
              name: String(obj.name || 'Formula'),
              expr: String(obj.expr || ''),
              createdAt: Number(obj.created_at) || Date.now(),
              isFavorite: Boolean(obj.is_favorite),
              sortOrder: Number(obj.sort_order) || 0,
            };
            if (obj.id != null) formulaItem.id = Number(obj.id);
            if (obj.description != null) formulaItem.description = String(obj.description);
            if (obj.type != null) formulaItem.type = String(obj.type);
            return formulaItem;
          });
        }
      } catch (err) {
        console.warn('Error reading custom_formulas:', err);
      }
    }

    // 7. Read node_positions if exists
    if (availableTables.has('node_positions')) {
      try {
        const posRes = sqlite.exec('SELECT id, x, y FROM node_positions');
        const firstPosRes = posRes[0];
        if (firstPosRes && firstPosRes.values) {
          result.extraTables = result.extraTables || {};
          result.extraTables.nodePositions = firstPosRes.values.map((row) => ({
            id: String(row?.[0] || ''),
            x: Number(row?.[1]) || 0,
            y: Number(row?.[2]) || 0,
          }));
        }
      } catch (err) {
        console.warn('Error reading node_positions:', err);
      }
    }

    // 8. Read math_scenes if exists
    if (availableTables.has('math_scenes')) {
      try {
        const sceneRes = sqlite.exec('SELECT id, name, description, created_at, updated_at, scene_json FROM math_scenes');
        const firstSceneRes = sceneRes[0];
        if (firstSceneRes && firstSceneRes.values) {
          result.extraTables = result.extraTables || {};
          result.extraTables.mathScenes = firstSceneRes.values.map((row) => {
            let sceneObj: any = {};
            try {
              sceneObj = JSON.parse(String(row?.[5] || '{}'));
            } catch {}
            const sceneItem: SavedMathScene = {
              name: String(row?.[1] || 'Math Scene'),
              createdAt: Number(row?.[3]) || Date.now(),
              updatedAt: Number(row?.[4]) || Date.now(),
              scene: sceneObj,
            };
            if (row?.[0] != null) sceneItem.id = Number(row[0]);
            if (row?.[2] != null) sceneItem.description = String(row[2]);
            return sceneItem;
          });
        }
      } catch (err) {
        console.warn('Error reading math_scenes:', err);
      }
    }

    // 9. Generic tables fallback for external/arbitrary SQLite databases
    const nonWorkspaceTables = Array.from(availableTables).filter(
      (t) =>
        ![
          'workspace_meta',
          'documents',
          'assets',
          'sticky_notes',
          'sticky_note_media',
          'custom_formulas',
          'node_positions',
          'math_scenes',
        ].includes(t)
    );

    if (result.documents.length === 0 && nonWorkspaceTables.length > 0) {
      const genericTables: Array<{
        tableName: string;
        columns: string[];
        rowCount: number;
        sampleData: Record<string, any>[];
      }> = [];

      for (const tbl of nonWorkspaceTables) {
        try {
          const query = sqlite.exec(`SELECT * FROM "${tbl.replace(/"/g, '""')}" LIMIT 2000`);
          const firstQuery = query[0];
          if (firstQuery && firstQuery.values) {
            const columns = firstQuery.columns;
            const rows = firstQuery.values.map((valRow) => {
              const rowObj: Record<string, any> = {};
              if (valRow) {
                columns.forEach((col, idx) => {
                  rowObj[col] = valRow[idx];
                });
              }
              return rowObj;
            });
            genericTables.push({
              tableName: tbl,
              columns,
              rowCount: rows.length,
              sampleData: rows,
            });

            // Convert to a document representation
            result.documents.push({
              name: `Table: ${tbl}`,
              code: JSON.stringify(rows, null, 2),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }
        } catch (tblErr) {
          console.warn(`Error reading table ${tbl}:`, tblErr);
        }
      }

      result.extraTables = result.extraTables || {};
      result.extraTables.genericTables = genericTables;
    }

    return result;
  } finally {
    sqlite.close();
  }
}

/**
 * Parses a SQL script string into structured workspace data.
 */
export async function parseSqlScriptWorkspace(sqlText: string): Promise<ParsedSqliteWorkspace> {
  const SQL = await getSqlJs();
  const sqlite = new SQL.Database();

  try {
    sqlite.run(sqlText);
    const exportedBytes = sqlite.export();
    return parseSqliteWorkspace(exportedBytes);
  } finally {
    sqlite.close();
  }
}

/**
 * Triggers a browser download of a binary Uint8Array as a file.
 */
export function downloadSqliteFile(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.sqlite') || filename.endsWith('.db') ? filename : `${filename}.sqlite`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Triggers a browser download of a text SQL script file.
 */
export function downloadSqlTextFile(sqlText: string, filename: string) {
  const blob = new Blob([sqlText], { type: 'application/sql' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.sql') ? filename : `${filename}.sql`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Helper to export the whole workspace or selected documents from Dexie into a SQLite binary download.
 */
export async function exportCurrentWorkspaceToSqlite(options?: {
  documentIds?: number[] | undefined;
  includeExtras?: boolean | undefined;
  filename?: string | undefined;
  format?: 'sqlite' | 'sql' | undefined;
} | undefined): Promise<void> {
  const allDocs = await db.documents.toArray();
  const activeDocId = useStore.getState().activeDocumentId;
  const currentCode = useStore.getState().code;
  const activeDocName = useStore.getState().activeDocumentName || 'Current Document';

  // Make sure active document with in-memory edits is synced
  let docsToExport: SavedDocument[] = [];
  if (options?.documentIds && options.documentIds.length > 0) {
    const idSet = new Set(options.documentIds);
    docsToExport = allDocs.filter((d) => idSet.has(d.id));
  } else {
    docsToExport = [...allDocs];
  }

  // If there's active code but no saved documents or active doc has unsaved code
  if (activeDocId) {
    const activeDocIndex = docsToExport.findIndex((d) => d.id === activeDocId);
    const existingDoc = activeDocIndex >= 0 ? docsToExport[activeDocIndex] : undefined;
    if (activeDocIndex >= 0 && existingDoc) {
      docsToExport[activeDocIndex] = {
        ...existingDoc,
        code: currentCode,
        updatedAt: Date.now(),
      };
    }
  } else if (docsToExport.length === 0 && currentCode.trim()) {
    docsToExport.push({
      id: 1,
      name: activeDocName,
      code: currentCode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  const firstDoc = docsToExport[0];
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseFilename =
    options?.filename ||
    (docsToExport.length === 1 && firstDoc
      ? firstDoc.name.replace(/[^a-zA-Z0-9_-]/g, '_')
      : `workspace_${dateStr}`);

  const stickyNoteMedia = options?.includeExtras ? await db.stickyNoteMedia.toArray() : undefined;

  const extras = options?.includeExtras
    ? {
        stickyNotes: await db.stickyNotes.toArray(),
        ...(stickyNoteMedia ? { stickyNoteMedia } : {}),
        customFormulas: await db.customFormulas.toArray(),
        nodePositions: await db.nodePositions.toArray(),
        mathScenes: await db.mathScenes.toArray(),
      }
    : undefined;

  if (options?.format === 'sql') {
    const sqlText = await exportDocumentsToSqlScript(docsToExport, {
      activeDocumentName: activeDocName,
    });
    downloadSqlTextFile(sqlText, baseFilename);
  } else {
    const binary = await exportDocumentsToSqliteBinary(
      docsToExport,
      {
        activeDocumentName: activeDocName,
      },
      extras
    );
    downloadSqliteFile(binary, baseFilename);
  }
}

/**
 * Creates a File/Blob representing the SQLite or SQL workspace, ready for transfer or upload.
 */
export async function createWorkspaceFileForTransfer(
  documents: SavedDocument[],
  format: 'sqlite' | 'sql' = 'sqlite',
  filename?: string | undefined
): Promise<File> {
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const firstDoc = documents[0];
  const defaultName =
    filename ||
    (documents.length === 1 && firstDoc
      ? firstDoc.name.replace(/[^a-zA-Z0-9_-]/g, '_')
      : `workspace_${dateStr}`);

  if (format === 'sql') {
    const sqlText = await exportDocumentsToSqlScript(documents);
    const blob = new Blob([sqlText], { type: 'application/sql' });
    return new File([blob], `${defaultName}.sql`, { type: 'application/sql' });
  } else {
    const bytes = await exportDocumentsToSqliteBinary(documents);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
    return new File([blob], `${defaultName}.sqlite`, { type: 'application/x-sqlite3' });
  }
}
