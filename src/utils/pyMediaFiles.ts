/**
 * Media files (images, video, sound, PDFs) for a Python run.
 *
 * A media file's value in the tree is not its contents but an asset id (`img_4f2a.png`) or a
 * URL - see mediaFiles.ts. Written as-is, Python would find a text file holding that id, under a
 * name without its extension. These are the real bytes instead, under the name the explorer shows
 * (`image.png`), taken from the full-size original rather than the thumbnail the canvas shows.
 */
import { cleanNodeName } from "./vfs";
import { detectMediaFile, mediaFileName } from "./mediaFiles";
import { getOriginalAsset, readAssetBlob } from "./assetManager";

/** Larger files are left out: every run copies them into the Python worker. */
export const MAX_MEDIA_BYTES = 64 * 1024 * 1024;

export interface PyMediaFiles {
    /** Bytes by file path, as Python sees it. */
    files: Record<string, Uint8Array>;
    /** Paths the plain file system would have used for these nodes; they hold no text file. */
    replaced: string[];
    /** Files too large to copy, by file path. */
    skipped: string[];
}

/** The name the explorer gives a node, before its media extension is put back. */
const nodeFileName = (key: string) =>
    /_image_node$/i.test(key) && !/\.img$/i.test(key) ? key.replace(/_image_node$/i, ".img") : cleanNodeName(key);

async function readMedia(source: string, isAsset: boolean): Promise<Blob | null> {
    if (isAsset) {
        const asset = await getOriginalAsset(source);
        if (!asset) return null;
        return await readAssetBlob(asset);
    }
    // data: and blob: URLs live in this page. Remote URLs are left to the script to download.
    if (/^(data|blob):/i.test(source)) {
        const response = await fetch(source);
        return response.ok ? await response.blob() : null;
    }
    return null;
}

export async function collectPyMediaFiles(
    parsedData: any,
    mimeTypes?: Record<string, { mimeType?: string } | undefined>,
): Promise<PyMediaFiles> {
    const found: { path: string; plainPath: string; source: string; isAsset: boolean }[] = [];

    // Walks the tree the way buildVirtualFS does, stopping at nodes that hold media.
    const walk = (obj: any, dir: string) => {
        if (typeof obj !== "object" || obj === null) return;
        for (const [key, val] of Object.entries(obj)) {
            const isNode = typeof val === "string" || (typeof val === "object" && val !== null && !Array.isArray(val));
            if (!isNode) continue;
            const media = detectMediaFile(key, val, mimeTypes);
            if (media) {
                found.push({
                    path: `${dir}/${mediaFileName(nodeFileName(key), media)}`,
                    // A string node would have been written as a file; an object, as a folder.
                    plainPath: typeof val === "string" ? `${dir}/${cleanNodeName(key)}` : `${dir}/${key}`,
                    source: media.source,
                    isAsset: media.isAsset,
                });
            } else if (typeof val === "object") {
                walk(val, `${dir}/${key}`);
            }
        }
    };
    walk(parsedData, "");

    const result: PyMediaFiles = { files: {}, replaced: [], skipped: [] };
    await Promise.all(
        found.map(async (file) => {
            try {
                const blob = await readMedia(file.source, file.isAsset);
                if (!blob) return;
                result.replaced.push(file.plainPath);
                if (blob.size > MAX_MEDIA_BYTES) {
                    result.skipped.push(file.path);
                    return;
                }
                result.files[file.path] = new Uint8Array(await blob.arrayBuffer());
            } catch (err) {
                console.warn(`[PyMedia]: Could not read ${file.path}`, err);
            }
        }),
    );
    return result;
}

/** Drops what the plain file system holds for media nodes: an id as text, or a folder of fields. */
export function withoutReplaced(vfs: Record<string, string>, replaced: string[]) {
    if (!replaced.length) return vfs;
    const result: Record<string, string> = {};
    for (const [path, content] of Object.entries(vfs)) {
        if (replaced.some((r) => path === r || path.startsWith(`${r}/`))) continue;
        result[path] = content;
    }
    return result;
}
