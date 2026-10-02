/**
 * The page's side of matching voice commands by meaning: owns the worker that runs the embedding
 * model, keeps the model downloaded (once, into OPFS), and keeps an index of the registered phrases.
 */
import { CommandRegistry, type VoiceCommand } from "../CommandRegistry";
import { useVoiceStore } from "../useVoiceStore";
import { IntentIndex, type IntentMatch } from "./intentMatcher";
import { getStoredModel, isStorageAvailable, removeStoredModel } from "./modelStore";
import type { MatcherRequest } from "./voiceMatcher.worker";

export type { IntentMatch };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: Float32Array[]) => void; reject: (e: Error) => void }>();

const setStatus = (matcherStatus: ReturnType<typeof useVoiceStore.getState>["matcherStatus"], extra: object = {}) =>
  useVoiceStore.setState({ matcherStatus, ...extra });

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./voiceMatcher.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = ({ data: m }) => {
      if (m.type === "progress") useVoiceStore.setState({ matcherProgress: m.total ? m.loaded / m.total : 0 });
      else if (m.type === "downloaded") finishDownload?.(null);
      else if (m.type === "download-error") finishDownload?.(new Error(m.message));
      else if (m.type === "embedded") {
        pending.get(m.id)?.resolve(m.vectors);
        pending.delete(m.id);
      } else if (m.type === "embed-error") {
        pending.get(m.id)?.reject(new Error(m.message));
        pending.delete(m.id);
      }
    };
  }
  return worker;
}

const send = (message: MatcherRequest) => getWorker().postMessage(message);

const embed = (texts: string[]) =>
  new Promise<Float32Array[]>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    send({ type: "embed", id, texts });
  });

let finishDownload: ((error: Error | null) => void) | null = null;
let preparing: Promise<boolean> | null = null;

let index: Promise<IntentIndex<VoiceCommand>> | null = null;
let indexedVersion = -1;

/** The phrase index, rebuilt when the registered commands change. */
function getIndex(): Promise<IntentIndex<VoiceCommand>> {
  const version = CommandRegistry.getVersion();
  if (!index || indexedVersion !== version) {
    const fresh = new IntentIndex<VoiceCommand>(embed);
    index = fresh.build(CommandRegistry.getCommands()).then(() => fresh);
    index.catch(() => (index = null));
    indexedVersion = version;
  }
  return index;
}

/**
 * Gets the matcher ready: downloads the model if it isn't stored yet (about 23 MB, once), then
 * loads it and indexes the commands. Resolves false if that isn't possible; never throws.
 */
export function prepare(): Promise<boolean> {
  if (preparing) return preparing;
  preparing = (async () => {
    try {
      if (!isStorageAvailable()) throw new Error("This browser can't store the model (OPFS is unavailable).");
      if (!(await getStoredModel())) {
        setStatus("downloading", { matcherProgress: 0, matcherError: null });
        await new Promise<void>((resolve, reject) => {
          finishDownload = (error) => {
            finishDownload = null;
            error ? reject(error) : resolve();
          };
          send({ type: "download" });
        });
      }
      setStatus("loading", { matcherError: null });
      await getIndex();
      setStatus("ready", { matcherError: null });
      return true;
    } catch (e: any) {
      setStatus("error", { matcherError: e?.message || String(e) });
      preparing = null; // allow a retry
      return false;
    }
  })();
  return preparing;
}

/** The command meant by any of the recognition alternatives, if the matcher is ready. */
export async function matchCommand(alternatives: string[]) {
  if (useVoiceStore.getState().matcherStatus !== "ready") return null;
  return (await getIndex()).match(alternatives);
}

export function cancelDownload() {
  if (worker) send({ type: "cancel" });
}

/** Stops the worker and deletes the stored model. */
export async function removeModel() {
  cancelDownload();
  worker?.terminate();
  worker = null;
  pending.forEach((p) => p.reject(new Error("The voice matcher was removed.")));
  pending.clear();
  preparing = null;
  index = null;
  await removeStoredModel();
  setStatus("absent", { matcherProgress: 0, matcherError: null });
}

/** Reflects whether the model is stored, without downloading or loading anything. */
export async function refreshStatus() {
  const { matcherStatus } = useVoiceStore.getState();
  if (matcherStatus !== "absent" && matcherStatus !== "unknown") return;
  setStatus((await getStoredModel()) ? "stored" : "absent");
}
