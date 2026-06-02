import { useState, useEffect, useRef, useCallback } from 'react';
import { getLogCount, loadLogsOffset, appendLogs } from './executionStore';

const CHUNK_SIZE = 500;

export function useExecutionLogs(path: string) {
  const [logCount, setLogCount] = useState(0);
  const [startOffset, setStartOffset] = useState(0);
  const [logChunks, setLogChunks] = useState<Record<number, any[]>>({});
  const chunkRequests = useRef<Set<number>>(new Set());

  const refreshCount = useCallback(async () => {
    const stats = await getLogCount(path);
    setLogCount(stats.logCount);
    setStartOffset(stats.startOffset);
  }, [path]);

  useEffect(() => {
    refreshCount();

    const handleClear = () => {
      setLogCount(0);
      setStartOffset(0);
      setLogChunks({});
      chunkRequests.current.clear();
    };

    const handleAppended = (e: any) => {
      let stats = e.detail;
      const processStats = (s: any) => {
        if (!s) return;
        setLogCount(s.logCount);
        setStartOffset(s.startOffset);
        
        if (typeof s.length === 'number') {
          const startChunk = Math.floor(Math.max(0, s.logCount - s.length - 1) / CHUNK_SIZE);
          const endChunk = Math.floor(Math.max(0, s.logCount) / CHUNK_SIZE);
          
          setLogChunks(prev => {
            const next = { ...prev };
            for (let c = startChunk; c <= endChunk; c++) {
              delete next[c];
              chunkRequests.current.delete(c);
            }
            return next;
          });
        }
      };

      if (stats && typeof stats.logCount === 'number') {
        processStats(stats);
      } else {
        getLogCount(path).then((res) => {
          // If we don't know the exact length, just invalidate the last 2 chunks
          const sC = Math.floor(Math.max(0, res.logCount - 1000) / CHUNK_SIZE);
          const eC = Math.floor(Math.max(0, res.logCount) / CHUNK_SIZE);
          setLogChunks(prev => {
            const next = { ...prev };
            for (let c = sC; c <= eC; c++) {
              delete next[c];
              chunkRequests.current.delete(c);
            }
            return next;
          });
          setLogCount(res.logCount);
          setStartOffset(res.startOffset);
        });
      }
    };

    window.addEventListener(`logs-cleared-${path}`, handleClear);
    window.addEventListener(`logs-appended-${path}`, handleAppended);
    return () => {
      window.removeEventListener(`logs-cleared-${path}`, handleClear);
      window.removeEventListener(`logs-appended-${path}`, handleAppended);
    };
  }, [path, refreshCount]);

  const loadChunk = async (chunkIndex: number) => {
    if (chunkRequests.current.has(chunkIndex)) return;
    chunkRequests.current.add(chunkIndex);
    
    try {
      const startIndex = chunkIndex * CHUNK_SIZE;
      const records = await loadLogsOffset(path, startIndex, CHUNK_SIZE);
      setLogChunks(prev => ({ ...prev, [chunkIndex]: records }));
    } catch(e) {
      chunkRequests.current.delete(chunkIndex); // allow retry
    }
  };

  const getLog = (realIndex: number) => {
    const chunkIndex = Math.floor(realIndex / CHUNK_SIZE);
    const localIndex = realIndex % CHUNK_SIZE;
    
    if (logChunks[chunkIndex]) {
      return logChunks[chunkIndex].find(l => l.index === realIndex) || null;
    } else {
      loadChunk(chunkIndex);
      return null;
    }
  };

  const clearLogs = async () => {
    setLogCount(0);
    setStartOffset(0);
    setLogChunks({});
    chunkRequests.current.clear();
    await appendLogs(path, [{ type: 'clear', args: [], time: new Date().toISOString() }]);
  };

  const visibleCount = logCount - startOffset;

  return { logCount: visibleCount, getLog, clearLogs, startOffset };
}

