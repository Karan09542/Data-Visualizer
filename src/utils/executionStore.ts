import Dexie, { Table } from 'dexie';

export interface LogEntry {
  path: string;
  index: number;
  type: string;
  args: any[];
  pos?: { line: number; col: number };
  time: string;
}

export interface SessionEntry {
  path: string;
  sessionId: string;
  timestamp: number;
  logCount: number;
  startOffset: number;
}

class ExecutionDB extends Dexie {
  logs!: Table<LogEntry, [string, number]>;
  sessions!: Table<SessionEntry, string>;

  constructor() {
    super('execution-store');
    // We add path+index as composite key for logs, and by-path index for quick deletion.
    this.version(1).stores({
      logs: '[path+index], path',
      sessions: 'path'
    });
  }
}

export const db = new ExecutionDB();

export const initExecutionDB = async () => {
  return db;
};

export const clearExecutionDB = async () => {
  await db.logs.clear();
  await db.sessions.clear();
};

export const resetNodeSession = async (path: string, sessionId: string) => {
  await db.transaction('rw', db.logs, db.sessions, async () => {
    await db.logs.where('path').equals(path).delete();
    await db.sessions.put({
      path,
      sessionId,
      timestamp: Date.now(),
      logCount: 0,
      startOffset: 0
    });
  });
  
  window.dispatchEvent(new CustomEvent(`logs-cleared-${path}`));
};

interface LogQueue {
  logs: any[];
  isWriting: boolean;
}
const writeQueues: Record<string, LogQueue> = {};

const processLogQueue = async (path: string) => {
  const queue = writeQueues[path];
  if (!queue || queue.logs.length === 0) {
    if (queue) queue.isWriting = false;
    return;
  }
  
  queue.isWriting = true;
  const logsToWrite = queue.logs.splice(0, 5000);
  
  try {
    let session = await db.sessions.get(path);
    if (!session) return; // Ignore if session was wiped
    
    // if logs contain 'clear' we reset first
    const lastClearIdx = logsToWrite.map(l => l.type).lastIndexOf('clear');
    let validLogs = logsToWrite;
    if (lastClearIdx !== -1) {
      validLogs = logsToWrite.slice(lastClearIdx + 1);
      
      // Clear old logs
      await db.logs.where('path').equals(path).delete();
      session.logCount = 0;
      session.startOffset = 0;
    }
    
    const logsToPut: LogEntry[] = [];
    for (const log of validLogs) {
      logsToPut.push({
        path,
        index: session.logCount++,
        type: log.type,
        args: log.args,
        pos: log.pos,
        time: log.time,
      });
    }
    
    // Auto-truncate from start (VS Code scrollback style)
    const MAX_SCROLLBACK = 20000;
    if (session.logCount - session.startOffset > MAX_SCROLLBACK) {
       session.startOffset = session.logCount - MAX_SCROLLBACK;
       
       await db.logs
          .where('[path+index]')
          .between([path, 0], [path, session.startOffset - 1])
          .delete();
    }
    
    await db.transaction('rw', db.logs, db.sessions, async () => {
       if (logsToPut.length > 0) {
           await db.logs.bulkAdd(logsToPut);
       }
       await db.sessions.put(session!);
    });
    
    window.dispatchEvent(new CustomEvent(`logs-appended-${path}`, { detail: { length: validLogs.length, logCount: session.logCount, startOffset: session.startOffset } }));
  } catch (err) {
    console.error("Log write error:", err);
  } finally {
    processLogQueue(path);
  }
};

export const appendLogs = async (path: string, logs: any[]) => {
  if (!logs || logs.length === 0) return;
  if (!writeQueues[path]) writeQueues[path] = { logs: [], isWriting: false };
  
  const lastClearIdx = logs.map(l => l.type).lastIndexOf('clear');
  if (lastClearIdx !== -1) {
      writeQueues[path].logs = logs.slice(lastClearIdx + 1);
      writeQueues[path].logs.unshift({ type: 'clear', time: new Date().toISOString(), args: [] });
  } else {
      writeQueues[path].logs.push(...logs);
  }
  
  if (!writeQueues[path].isWriting) {
      processLogQueue(path);
  }
};

export const getLogCount = async (path: string): Promise<{logCount: number, startOffset: number}> => {
  const session = await db.sessions.get(path);
  return session ? { logCount: session.logCount, startOffset: session.startOffset || 0 } : { logCount: 0, startOffset: 0 };
};

export const loadLogsOffset = async (path: string, startIndex: number, count: number) => {
  return await db.logs
    .where('[path+index]')
    .between([path, startIndex], [path, startIndex + count - 1])
    .toArray();
};

export const clearNodeSession = async (path: string) => {
    await db.transaction('rw', db.logs, db.sessions, async () => {
        await db.logs.where('path').equals(path).delete();
        await db.sessions.delete(path);
    });
    window.dispatchEvent(new CustomEvent(`logs-cleared-${path}`));
};

export const abortExecutionQueue = (path: string) => {
  if (writeQueues[path]) writeQueues[path].logs = [];
};
