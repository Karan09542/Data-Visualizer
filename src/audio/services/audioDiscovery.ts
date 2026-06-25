import { db } from "../../lib/db";
import { useStore } from "../../store/useStore";
import { AudioTrack } from "../types/audio";
import { v4 as uuidv4 } from "uuid";
import * as mm from "music-metadata";

export const discoverAudio = async () => {
  const tracks: AudioTrack[] = [];
  const storedTracks = await db.audio_tracks.toArray();
  const assets = await db.assets.toArray();

  // Update blob URLs for stored tracks
  for (const track of storedTracks) {
    let updated = false;
    if (track.source && track.source.startsWith("blob:")) {
      const asset = assets.find((a) => a.assetId === track.id);
      if (asset && asset.data) {
        let blob: Blob;
        if (asset.data instanceof Blob) {
          blob = asset.data;
        } else {
          blob = new Blob([asset.data], { type: asset.mimeType || track.type });
        }
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

  // 2. Discover from main DB assets
  const audioAssets = assets.filter(
    (a) => a.mimeType && a.mimeType.startsWith("audio/"),
  );

  for (const asset of audioAssets) {
    if (!storedIds.has(asset.assetId)) {
      let source = "";
      let blob: Blob | null = null;
      if (asset.data instanceof Blob) {
        blob = asset.data;
        source = URL.createObjectURL(asset.data);
      } else if (asset.data instanceof ArrayBuffer) {
        blob = new Blob([asset.data], { type: asset.mimeType });
        source = URL.createObjectURL(blob);
      }

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

  // 3. Scan workspace JSON data for audio URLs
  const rootData = useStore.getState().parsedData;
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
    // Generate a consistent ID based on the URL so we don't duplicate
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
