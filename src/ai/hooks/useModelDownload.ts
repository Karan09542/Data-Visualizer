import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { modelRegistry } from '../registry/ModelRegistry';
import { modelManager } from '../manager/ModelManager';
import { opfsStorage } from '../manager/OPFSStorage';

export type ModelDownloadStatus = 'checking' | 'missing' | 'downloading' | 'ready' | 'error';

export interface ModelDownloadState {
  status: ModelDownloadStatus;
  /** 0-100 while downloading. */
  progress: number;
  error: string | null;
  /** Bytes, from the manifest when known, else the cached file. 0 when unknown. */
  sizeBytes: number;
  /** True once the bytes are available locally (OPFS or bundled). */
  isReady: boolean;
  /**
   * True only when an OPFS copy exists. Distinct from isReady: a bundled model is always ready
   * but may have no cached copy, and collapsing the two made "delete" look like it did nothing.
   */
  isCached: boolean;
  /** True when the model ships with the app and cannot be uninstalled. */
  isBundled: boolean;
  isDownloading: boolean;
  start: () => Promise<boolean>;
  cancel: () => void;
  /** Re-reads availability, e.g. after the model is deleted elsewhere. */
  refresh: () => void;
  /** Removes the cached copy from OPFS. */
  remove: () => Promise<void>;
}

export const formatModelSize = (bytes: number): string => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes > 100 * 1024 * 1024 ? 0 : 1)} MB`;
};

/**
 * Availability and download control for a single model.
 *
 * The download is abortable end to end: the AbortSignal reaches fetch inside ModelDownloader, so
 * cancelling tears down the connection rather than merely hiding the progress bar.
 */
export function useModelDownload(modelId: string | undefined): ModelDownloadState {
  const manifest = useMemo(() => (modelId ? modelRegistry.get(modelId) : undefined), [modelId]);

  const [status, setStatus] = useState<ModelDownloadStatus>('checking');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sizeBytes, setSizeBytes] = useState(0);
  const [isCached, setIsCached] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  // Guards against setState after unmount, and against a stale check for a previous modelId
  // overwriting the status of the one now selected.
  const activeIdRef = useRef<string | undefined>(modelId);

  useEffect(() => {
    activeIdRef.current = modelId;
  }, [modelId]);

  useEffect(() => {
    let cancelled = false;

    if (!manifest) {
      setStatus(modelId ? 'error' : 'checking');
      setError(modelId ? `Model "${modelId}" is not registered.` : null);
      return;
    }

    setStatus('checking');
    setError(null);

    (async () => {
      const cached = await opfsStorage.hasModel(manifest);
      // A bundled model is always usable even before it has been copied into OPFS.
      const isLocal = manifest.sources[0]?.type === 'local';
      const available = cached || isLocal;

      if (cancelled || activeIdRef.current !== modelId) return;

      const cachedSize = cached ? await opfsStorage.getModelSize(manifest) : null;
      if (cancelled || activeIdRef.current !== modelId) return;

      setSizeBytes(cachedSize || manifest.size || 0);
      setIsCached(cached);
      setStatus(available ? 'ready' : 'missing');
    })();

    return () => { cancelled = true; };
  }, [manifest, modelId, refreshToken]);

  // Abort anything still running if the consumer unmounts or switches model.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [modelId]);

  const start = useCallback(async (): Promise<boolean> => {
    if (!manifest || !modelId) return false;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('downloading');
    setProgress(0);
    setError(null);

    try {
      await modelManager.download(
        modelId,
        (p) => {
          if (!controller.signal.aborted) setProgress(Math.min(100, Math.round(p)));
        },
        controller.signal
      );
      if (controller.signal.aborted) return false;
      setStatus('ready');
      setIsCached(true);
      setProgress(100);
      const size = await opfsStorage.getModelSize(manifest);
      if (size) setSizeBytes(size);
      return true;
    } catch (e: any) {
      // An abort is a user action, not a failure to report.
      if (controller.signal.aborted || e?.name === 'AbortError') {
        setStatus('missing');
        setProgress(0);
        return false;
      }
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Download failed.');
      return false;
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [manifest, modelId]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('missing');
    setProgress(0);
  }, []);

  const refresh = useCallback(() => setRefreshToken(t => t + 1), []);

  const remove = useCallback(async () => {
    if (!manifest) return;
    abortRef.current?.abort();
    abortRef.current = null;
    await opfsStorage.deleteModel(manifest);
    setSizeBytes(0);
    setProgress(0);
    setIsCached(false);
    // A bundled model stays usable from /models/ even with its OPFS copy gone, so it stays
    // 'ready'. isCached is what actually changes, and the UI keys the delete control off that.
    setStatus(manifest.sources[0]?.type === 'local' ? 'ready' : 'missing');
  }, [manifest]);

  return {
    status,
    progress,
    error,
    sizeBytes,
    isReady: status === 'ready',
    isCached,
    isBundled: manifest?.sources[0]?.type === 'local',
    isDownloading: status === 'downloading',
    start,
    cancel,
    refresh,
    remove
  };
}
