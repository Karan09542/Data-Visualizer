/**
 * Streaming a download straight into the Origin Private File System, so a large model file
 * never has to sit in memory whole. Shared by the on-device models (formula reader, voice).
 */

/** Writes a response body to an OPFS file as it arrives. */
export async function writeResponse(
  dir: FileSystemDirectoryHandle,
  name: string,
  response: Response,
  onBytes: (n: number) => void,
  signal: AbortSignal,
): Promise<number> {
  const handle = await dir.getFileHandle(name, { create: true });
  const reader = response.body!.getReader();
  let written = 0;
  // createWritable is the usual way; Safari before 26 only offers sync access handles,
  // which are available in workers, where the download runs.
  const writable = typeof (handle as any).createWritable === "function" ? await (handle as any).createWritable() : null;
  const sync = writable ? null : await (handle as any).createSyncAccessHandle();
  try {
    if (sync) sync.truncate(0);
    for (;;) {
      if (signal.aborted) throw new DOMException("Download cancelled", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      if (writable) await writable.write(value);
      else sync.write(value, { at: written });
      written += value.byteLength;
      onBytes(value.byteLength);
    }
    if (writable) await writable.close();
    else {
      sync.flush();
      sync.close();
    }
    return written;
  } catch (e) {
    try {
      if (writable) await writable.abort();
      else sync?.close();
    } catch {
      /* already closed */
    }
    reader.cancel().catch(() => {});
    throw e;
  }
}

export async function fetchOk(url: string, signal: AbortSignal): Promise<Response> {
  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok || !response.body) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response;
}
