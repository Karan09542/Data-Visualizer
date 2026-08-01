import { db } from '../../../lib/db';
import { v4 as uuidv4 } from 'uuid';

export const MediaStore = {
  async saveMedia(noteId: string, mimeType: string, data: Blob): Promise<string> {
    const id = uuidv4();
    await db.stickyNoteMedia.add({
      id,
      noteId,
      mimeType,
      data,
      createdAt: Date.now(),
    });
    return id;
  },

  async getMedia(id: string): Promise<Blob | null> {
    const media = await db.stickyNoteMedia.get(id);
    return media ? media.data : null;
  },

  async deleteMedia(id: string): Promise<void> {
    await db.stickyNoteMedia.delete(id);
  },

  async getMediaUrl(id: string): Promise<string | null> {
    const blob = await this.getMedia(id);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }
};
