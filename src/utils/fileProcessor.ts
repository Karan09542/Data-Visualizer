import { useStore } from "../store/useStore";
import { importFile } from "./assetManager";

export const processFiles = async (files: File[]) => {
  if (files.length === 0) return;

  // Currently processing the first file
  // TODO: Add bulk process UI support
  const file = files[0];
  const { name, type, size } = file;

  const isImage = type.startsWith("image/");
  const isVideo = type.startsWith("video/");
  const isAudio = type.startsWith("audio/");
  const isPdf =
    type === "application/pdf" || name.toLowerCase().endsWith(".pdf");
  const is3dModel =
    type.startsWith("model/") ||
    name.toLowerCase().match(/\.(glb|gltf|obj|stl|fbx)$/);
  const isExcel =
    type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    type === "application/vnd.ms-excel" ||
    name.toLowerCase().endsWith(".xlsx") ||
    name.toLowerCase().endsWith(".xls");

  const isMedia = isImage || isVideo || isAudio || isPdf || !!is3dModel;

  if (isMedia) {
    try {
      const { assetId, thumbnailId } = await importFile(file);
      useStore.getState().setPendingImport({
        filename: name,
        fileContext: "media",
        mimeType: type,
        fileSize: size,
        assetId,
        thumbnailId,
        blobUrl: assetId,
      });
    } catch (e) {
      console.error("Asset import failed, falling back to blob", e);
      const hash = isImage
        ? "#image"
        : isVideo
          ? "#video"
          : isAudio
            ? "#audio"
            : isPdf
              ? "#pdf"
              : is3dModel
                ? "#model"
                : "";
      const blobUrl = URL.createObjectURL(file) + hash;
      useStore.getState().setPendingImport({
        filename: name,
        fileContext: "media",
        mimeType: type,
        fileSize: size,
        blobUrl,
      });
    }
    return;
  }

  const isTextLike =
    type.startsWith("text/") ||
    type === "application/json" ||
    type === "application/xml" ||
    type === "application/yaml" ||
    name.match(/\.(json|csv|yaml|yml|tsv|txt|md|xml)$/i);

  if (!isMedia && !isExcel && !isTextLike) {
    useStore.getState().setNotification({
      message: `Unsupported file type: ${name}. Please upload text, data, or standard media files.`,
      type: "error",
    });
    return;
  }

  const reader = new FileReader();
  useStore.getState().setFileProcessing(true);

  reader.onload = async (event) => {
    try {
      const result = event.target?.result;
      if (!result) return;

      if (isExcel) {
        const { parseExcel } = await import("./dataFormats");
        const dataExcel = await parseExcel(result as ArrayBuffer);
        useStore.getState().setPendingImport({
          filename: name,
          fileContext: "data",
          mimeType: type,
          fileSize: size,
          dataExcel,
        });
      } else {
        useStore.getState().setPendingImport({
          filename: name,
          text: result as string,
          fileContext: "data",
          mimeType: type,
          fileSize: size,
        });
      }
    } catch (e) {
      console.error("Failed to parse file", e);
      useStore.getState().setNotification({
        message: `Failed to parse file: ${name}`,
        type: "error",
      });
    } finally {
      useStore.getState().setFileProcessing(false);
    }
  };

  reader.onerror = () => {
    useStore.getState().setFileProcessing(false);
    useStore.getState().setNotification({
      message: `Error reading file: ${name}`,
      type: "error",
    });
  };

  reader.onabort = () => {
    useStore.getState().setFileProcessing(false);
  };

  if (isExcel) {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file);
  }
};
