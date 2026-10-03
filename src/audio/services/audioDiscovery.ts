import { db } from "../../lib/db";
import { useStore } from "../../store/useStore";
import { useAudioStore } from "../stores/audioStore";
import { AudioTrack } from "../types/audio";
import { collectReferencedAssetIds, readAssetBlob } from "../../utils/assetManager";
import { v4 as uuidv4 } from "uuid";
import * as mm from "music-metadata";
import { resolveUploadCover } from "./audioUploads";

export const discoverAudio = async () => {
  const tracks: AudioTrack[] = [];
  const storedTracks = await db.audio_tracks.toArray();
  const assets = await db.assets.toArray();
  
  const rootData = useStore.getState().parsedData;
  const referencedIds = collectReferencedAssetIds(rootData);
  
  const validIds = new Set<string>();

  // 1. Discover from main DB assets
  const audioAssets = assets.filter(
    (a) => a.mimeType && a.mimeType.startsWith("audio/") && referencedIds.has(a.assetId),
  );

  for (const asset of audioAssets) {
    validIds.add(asset.assetId);
  }

  // 2. Scan workspace JSON data for audio URLs

  const urlsFound = new Set<string>();

  const scanObject = (obj: any) => {
    if (!obj) return;
    if (typeof obj === "string") {
      if (obj.match(/https?:\/\/.*\.(mp3|wav|ogg)/i)) {
        urlsFound.add(obj);
      }
    } else if (typeof obj === "object") {
      Object.values(obj).forEach(scanObject);
    }
  };

  if (rootData) {
    scanObject(rootData);
  }

  for (const url of Array.from(urlsFound)) {
    const id = btoa(encodeURIComponent(url)).replace(/=/g, "");
    validIds.add(id);
  }

  // 3. Remove obsolete tracks. Uploads are never in the workspace data, so they are kept
  // until someone deletes them from the library.
  const invalidTracks = storedTracks.filter((t) => t.origin !== "upload" && !validIds.has(t.id));
  if (invalidTracks.length > 0) {
    const invalidIds = invalidTracks.map((t) => t.id);
    await db.audio_tracks.bulkDelete(invalidIds);
    
    // Remove from in-memory storedTracks for further processing
    for (let i = storedTracks.length - 1; i >= 0; i--) {
      if (invalidIds.includes(storedTracks[i].id)) {
        storedTracks.splice(i, 1);
      }
    }

    // Clean up AudioStore state if obsolete tracks were in queue or currently playing
    const audioStore = useAudioStore.getState();
    const currentTrack = audioStore.currentTrack;
    if (currentTrack && invalidIds.includes(currentTrack.id)) {
      audioStore.setCurrentTrack(null);
      audioStore.setIsPlaying(false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('audio-stop-track'));
      }
    }
    
    const newQueue = audioStore.queue.filter((t) => !invalidIds.includes(t.id));
    if (newQueue.length !== audioStore.queue.length) {
      audioStore.setQueue(newQueue);
      if (audioStore.queueIndex >= newQueue.length) {
        audioStore.setQueueIndex(newQueue.length > 0 ? 0 : -1);
      }
    }
  }

  // Update blob URLs for stored tracks
  for (const track of storedTracks) {
    if (track.origin === "upload") {
      // The file itself is read when it is played; only the small cover is loaded here
      track.source = "";
      track.thumbnail = await resolveUploadCover(track);
      continue;
    }
    let updated = false;
    if (track.source && track.source.startsWith("blob:")) {
      const asset = assets.find((a) => a.assetId === track.id);
      const blob = asset ? await readAssetBlob(asset) : null;
      if (blob) {
        track.source = URL.createObjectURL(blob);
        updated = true;

        if (!track.thumbnail || track.thumbnail.startsWith("blob:")) {
          try {
            const metadata = await mm.parseBlob(blob);
            const picture =
              metadata.common.picture && metadata.common.picture[0];
            if (picture) {
              const picBlob = new Blob([picture.data], {
                type: picture.format,
              });
              track.thumbnail = URL.createObjectURL(picBlob);
              updated = true;
            }
          } catch (e) {
            console.error("Failed to parse audio metadata on reload", e);
          }
        }
      }
    }
    if (updated) {
      await db.audio_tracks.put(track); // Update the DB with the new blob URL
    }
  }

  const storedIds = new Set(storedTracks.map((t) => t.id));

  // 1. Check existing dexie table
  tracks.push(...storedTracks);

  for (const asset of audioAssets) {
    if (!storedIds.has(asset.assetId)) {
      const blob = await readAssetBlob(asset);
      const source = blob ? URL.createObjectURL(blob) : "";

      let title = asset.filename || "Unknown Audio File";
      let artist = undefined;
      let thumbnail = undefined;

      if (blob) {
        try {
          const metadata = await mm.parseBlob(blob);
          if (metadata.common.title) {
            title = metadata.common.title;
          }
          if (metadata.common.artist) {
            artist = metadata.common.artist;
          }
          const picture = metadata.common.picture && metadata.common.picture[0];
          if (picture) {
            const picBlob = new Blob([picture.data], { type: picture.format });
            thumbnail = URL.createObjectURL(picBlob);
          }
        } catch (e) {
          console.error("Failed to parse audio metadata", e);
        }
      }

      const newTrack: AudioTrack = {
        id: asset.assetId,
        title,
        artist,
        thumbnail,
        source,
        type: asset.mimeType,
        createdAt: asset.createdAt,
      };

      tracks.push(newTrack);
      await db.audio_tracks.put(newTrack);
      storedIds.add(newTrack.id);
    }
  }

  for (const url of Array.from(urlsFound)) {
    const id = btoa(encodeURIComponent(url)).replace(/=/g, "");
    if (!storedIds.has(id)) {
      const type = url.endsWith(".wav")
        ? "audio/wav"
        : url.endsWith(".ogg")
          ? "audio/ogg"
          : "audio/mpeg";
      const parts = url.split("/");
      const title = parts[parts.length - 1] || "Web Audio Track";

      const newTrack: AudioTrack = {
        id,
        title,
        source: url,
        type,
        createdAt: Date.now(),
      };

      tracks.push(newTrack);
      await db.audio_tracks.put(newTrack);
      storedIds.add(id);
    }
  }

  return tracks.sort((a, b) => b.createdAt - a.createdAt);
};
