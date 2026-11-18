/**
 * Runs ffmpeg commands with the engine kept on the device (see coreStore). One command at a
 * time; a cancel or a crash stops the engine, and the next command starts a fresh one.
 */
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { readCoreFiles } from "./coreStore";

let engine: FFmpeg | null = null;
let starting: Promise<FFmpeg> | null = null;
let urls: string[] = [];
let queue: Promise<unknown> = Promise.resolve();
let cancelRunning: (() => void) | null = null;

/** Starts the engine (it must have been downloaded). */
export function startFFmpeg(): Promise<FFmpeg> {
  if (engine) return Promise.resolve(engine);
  if (!starting) {
    starting = (async () => {
      const files = await readCoreFiles();
      if (!files) throw new Error("The audio engine isn't downloaded yet.");
      urls = [URL.createObjectURL(files.js), URL.createObjectURL(files.wasm)];
      const ff = new FFmpeg();
      try {
        await ff.load({ coreURL: urls[0], wasmURL: urls[1] });
      } catch (e) {
        ff.terminate();
        stopFFmpeg();
        throw e;
      }
      engine = ff;
      return ff;
    })().finally(() => (starting = null));
  }
  return starting;
}

export const isFFmpegRunning = () => !!engine;

/** Stops the engine; the next command starts it again. */
export function stopFFmpeg() {
  engine?.terminate();
  engine = null;
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls = [];
}

/** Stops the command that's running, if any. */
export const cancelFFmpeg = () => cancelRunning?.();

export class Cancelled extends Error {
  constructor() {
    super("Cancelled");
    this.name = "Cancelled";
  }
}

export interface RunInput {
  name: string;
  data: Blob;
}

export interface RunOptions {
  /** Files to read back afterwards. */
  outputs?: string[];
  /** Also every file whose name starts with this (e.g. split parts). */
  outputPrefix?: string;
  /** Stops this job: skipped if it hasn't started, ended if it's running. */
  signal?: AbortSignal;
  /** ratio 0–1 as ffmpeg reports it; seconds of output written so far. */
  onProgress?: (ratio: number, seconds: number) => void;
}

export interface RunResult {
  code: number;
  /** Read-back files, in name order. */
  files: { name: string; data: Uint8Array }[];
  log: string[];
}

/** Writes the inputs, runs `ffmpeg …args`, reads the outputs, cleans up. Rejects only on cancel or crash. */
export function runFFmpeg(args: string[], inputs: RunInput[], opts: RunOptions = {}): Promise<RunResult> {
  const job = queue.then(async () => {
    if (opts.signal?.aborted) throw new Cancelled(); // given up while waiting its turn
    const ff = await startFFmpeg();
    const log: string[] = [];
    const onLog = ({ message }: { message: string }) => {
      log.push(message);
      if (log.length > 600) log.splice(0, 200);
    };
    const onProgress = ({ progress, time }: { progress: number; time: number }) =>
      opts.onProgress?.(Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0, Number.isFinite(time) ? Math.max(0, time / 1e6) : 0);
    ff.on("log", onLog);
    ff.on("progress", onProgress);
    let stopped = false;
    cancelRunning = () => {
      stopped = true;
      stopFFmpeg(); // ending the worker is the only way to stop a running command
    };
    const onAbort = () => cancelRunning?.();
    opts.signal?.addEventListener("abort", onAbort);
    const created = new Set<string>();
    try {
      for (const i of inputs) {
        await ff.writeFile(i.name, new Uint8Array(await i.data.arrayBuffer()));
        created.add(i.name);
      }
      const code = await ff.exec(args);
      const names = [...(opts.outputs ?? [])];
      if (opts.outputPrefix) {
        for (const e of await ff.listDir(".").catch(() => [])) if (!e.isDir && e.name.startsWith(opts.outputPrefix)) names.push(e.name);
      }
      names.sort();
      names.forEach((n) => created.add(n));
      const files: RunResult["files"] = [];
      if (code === 0) {
        for (const name of names) {
          const data = await ff.readFile(name).catch(() => null);
          if (data && typeof data !== "string" && data.length) files.push({ name, data });
        }
      }
      return { code, files, log };
    } catch (e) {
      if (stopped) throw new Cancelled();
      // a crash inside the engine (e.g. "memory access out of bounds") leaves it unusable
      stopped = true;
      stopFFmpeg();
      throw e;
    } finally {
      opts.signal?.removeEventListener("abort", onAbort);
      cancelRunning = null;
      if (!stopped && engine === ff) {
        ff.off("log", onLog);
        ff.off("progress", onProgress);
        for (const n of created) await ff.deleteFile(n).catch(() => {});
      }
    }
  });
  queue = job.catch(() => {});
  return job;
}

/** The useful line of a failed run's log. */
export function errorFromLog(log: string[]): string {
  const lines = log.map((l) => l.trim()).filter((l) => l && !/^(built with|configuration:|lib\w+\s+\d)/.test(l));
  return [...lines].reverse().find((l) => /error|invalid|no such|not found|unknown|failed|cannot|could not|unable/i.test(l)) || lines[lines.length - 1] || "ffmpeg stopped with an error";
}
