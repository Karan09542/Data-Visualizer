/**
 * Audio added from the player's Upload button. The file goes to OPFS where the device can write
 * it and to IndexedDB where it cannot (createDeviceFileStore decides). Only the track's details
 * go in db.audio_tracks, and nothing is written to the workspace data, so uploads stay out of the
 * canvas and out of the workspace's asset cleanup.
 */
import { v4 as uuidv4 } from "uuid";
import { db } from "../../lib/db";
import { createDeviceFileStore, type StorageBackend } from "../../utils/deviceFileStore";
import type { AudioTrack } from "../types/audio";

const store = createDeviceFileStore({
  opfsPath: ["audio", "uploads"],
  table: () => db.audioFiles,
});

/** File types Howler can play, by extension. It picks a codec from the type, so these must be exact. */
const PLAYABLE = new Set(["mp3", "mpeg", "opus", "ogg", "oga", "wav", "aac", "caf", "m4a", "m4b", "mp4", "weba", "webm", "flac"]);

export const UPLOAD_ACCEPT = "audio/*,video/mp4,video/webm,.mp3,.m4a,.m4b,.aac,.wav,.ogg,.oga,.opus,.flac,.weba,.webm,.caf";

const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

/** True for files the player can play: audio, or video whose sound it can play */
export const isPlayableMedia = (file: File) => {
  if (file.type.startsWith("audio/")) return true;
  if (file.type === "video/mp4" || file.type === "video/webm") return true;
  return PLAYABLE.has(extensionOf(file.name));
};

/** A type the engine turns into the right codec: "audio/<ext>" when the extension is one it knows */
const playableType = (file: File) => {
  const ext = extensionOf(file.name);
  if (PLAYABLE.has(ext)) return `audio/${ext}`;
  return file.type || "audio/mpeg";
};

const coverKey = (key: string) => `${key}#cover`;

// Object URLs made this session, so each file is read and wrapped once rather than on every refresh
const sourceUrls = new Map<string, string>();
const coverUrls = new Map<string, string>();

export interface UploadResult {
  tracks: AudioTrack[];
  /** Files that were skipped, with why */
  skipped: { name: string; reason: string }[];
  /** Where the files went on this device */
  backend: StorageBackend | null;
}

export async function uploadAudioFiles(files: File[]): Promise<UploadResult> {
  const mm = await import("music-metadata");
  const result: UploadResult = { tracks: [], skipped: [], backend: null };

  for (const file of files) {
    if (!isPlayableMedia(file)) {
      result.skipped.push({ name: file.name, reason: "Not an audio file" });
      continue;
    }

    const id = `upload-${uuidv4()}`;
    const key = `audio-upload://${id}/${file.name}`;
    let title = file.name.replace(/\.[^.]+$/, "");
    let artist: string | undefined;
    let duration: number | undefined;
    let cover: { data: ArrayBuffer; type: string } | null = null;

    try {
      const meta = await mm.parseBlob(file, { duration: false });
      if (meta.common.title) title = meta.common.title;
      if (meta.common.artist) artist = meta.common.artist;
      if (meta.format.duration) duration = meta.format.duration;
      const picture = meta.common.picture?.[0];
      if (picture) {
        const bytes = picture.data;
        cover = {
          data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
          type: picture.format,
        };
      }
    } catch {
      // No readable tags: the file name stands in as the title
    }

    try {
      result.backend = await store.write(key, await file.arrayBuffer());
      if (cover) await store.write(coverKey(key), cover.data);
    } catch (err) {
      await store.remove(key).catch(() => {});
      const full = err instanceof DOMException && err.name === "QuotaExceededError";
      result.skipped.push({ name: file.name, reason: full ? "This device is out of storage space" : "Could not be saved" });
      continue;
    }

    const track: AudioTrack = {
      id,
      title,
      artist,
      duration,
      source: "",
      type: playableType(file),
      createdAt: Date.now(),
      origin: "upload",
      storageKey: key,
      hasCover: !!cover,
      size: file.size,
    };
    await db.audio_tracks.put(track);
    if (cover) coverUrls.set(id, URL.createObjectURL(new Blob([cover.data], { type: cover.type })));
    result.tracks.push({ ...track, thumbnail: coverUrls.get(id) });
  }

  return result;
}

/** A playable URL for an uploaded track, read from the device store the first time it is asked for */
export async function resolveUploadSource(track: AudioTrack): Promise<string> {
  const cached = sourceUrls.get(track.id);
  if (cached) return cached;
  if (!track.storageKey) throw new Error(`Track ${track.id} has no stored file`);
  const data = await store.read(track.storageKey);
  if (!data) throw new Error(`The file for "${track.title}" is no longer on this device`);
  const url = URL.createObjectURL(new Blob([data], { type: track.type }));
  sourceUrls.set(track.id, url);
  return url;
}

/** The cover art URL for an uploaded track, if it has one. Covers are small, so this is cheap. */
export async function resolveUploadCover(track: AudioTrack): Promise<string | undefined> {
  if (!track.hasCover || !track.storageKey) return undefined;
  const cached = coverUrls.get(track.id);
  if (cached) return cached;
  const data = await store.read(coverKey(track.storageKey)).catch(() => null);
  if (!data) return undefined;
  const url = URL.createObjectURL(new Blob([data]));
  coverUrls.set(track.id, url);
  return url;
}

/** Deletes an uploaded track and its file from this device */
export async function removeUploadedTrack(track: AudioTrack): Promise<void> {
  if (track.storageKey) {
    await store.remove(track.storageKey);
    await store.remove(coverKey(track.storageKey));
  }
  await db.audio_tracks.delete(track.id);
  for (const urls of [sourceUrls, coverUrls]) {
    const url = urls.get(track.id);
    if (url) URL.revokeObjectURL(url);
    urls.delete(track.id);
  }
}

export const uploadStorageBackend = () => store.backend();
