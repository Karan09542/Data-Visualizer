import React, { useState, useRef } from "react";
import { FileImage, Download, Trash2, GripVertical, AlertCircle } from "lucide-react";
import { jsPDF } from "jspdf";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
}

const SortableImageItem = ({
  item,
  onRemove,
}: {
  item: ImageItem;
  onRemove: (id: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm ${
        isDragging ? "opacity-50 ring-2 ring-blue-500" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded"
        >
          <GripVertical size={16} className="text-slate-400" />
        </div>
        <img
          src={item.previewUrl}
          alt={item.file.name}
          className="w-12 h-12 object-cover rounded bg-slate-100 dark:bg-slate-800"
        />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-[200px]">
            {item.file.name}
          </span>
          <span className="text-xs text-slate-400">
            {(item.file.size / 1024 / 1024).toFixed(2)} MB
          </span>
        </div>
      </div>
      <button
        onClick={() => onRemove(item.id)}
        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};

export const ImageToPdfConverter = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfName, setPdfName] = useState("converted-images");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages = Array.from(e.target.files)
        .filter((file) => file.type.startsWith("image/"))
        .map((file) => ({
          id: Math.random().toString(36).substring(7),
          file,
          previewUrl: URL.createObjectURL(file),
        }));
      setImages((prev) => [...prev, ...newImages]);
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const generatePDF = async () => {
    if (images.length === 0) return;
    setIsGenerating(true);
    setError("");

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < images.length; i++) {
        if (i > 0) pdf.addPage();
        
        const img = images[i];
        
        // Load image to get dimensions
        const imgObj = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.src = img.previewUrl;
          image.onload = () => resolve(image);
          image.onerror = reject;
        });

        // Calculate aspect ratio to fit A4 page with a margin to prevent clipping
        const margin = 20;
        const availableWidth = pageWidth - (margin * 2);
        const availableHeight = pageHeight - (margin * 2);

        const imgRatio = imgObj.width / imgObj.height;
        const pageRatio = availableWidth / availableHeight;

        let renderWidth = availableWidth;
        let renderHeight = availableHeight;

        if (imgRatio > pageRatio) {
          renderWidth = availableWidth;
          renderHeight = availableWidth / imgRatio;
        } else {
          renderHeight = availableHeight;
          renderWidth = availableHeight * imgRatio;
        }

        // Center on page
        const x = margin + (availableWidth - renderWidth) / 2;
        const y = margin + (availableHeight - renderHeight) / 2;

        const imgType = img.file.type.toUpperCase().includes("PNG") ? "PNG" : 
                       (img.file.type.toUpperCase().includes("WEBP") ? "WEBP" : "JPEG");

        pdf.addImage(imgObj, imgType, x, y, renderWidth, renderHeight);
      }

      pdf.save(`${pdfName || "converted-images"}.pdf`);
    } catch (err) {
      console.error(err);
      setError("Failed to generate PDF. Make sure your images are valid.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full">
      <div className="flex flex-col items-stretch justify-start p-6 md:p-8 w-full max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-blue-200 dark:border-blue-800/50">
          <FileImage size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          Image to PDF
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          Combine multiple images into a single, beautifully formatted PDF document.
        </p>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        className="w-full h-40 p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl bg-slate-50 dark:bg-[#161b22]/50 flex flex-col items-center justify-center cursor-pointer transition-colors mb-8 group"
      >
        <FileImage
          size={28}
          className="text-slate-400 group-hover:text-blue-500 mb-2 transition-colors"
        />
        <span className="text-slate-600 dark:text-slate-300 font-medium">
          Click or drag to add images
        </span>
        <span className="text-slate-400 text-xs mt-1">Supports JPG, PNG, WEBP</span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {error && (
        <div className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 p-3 rounded-lg mb-6 flex items-center gap-2">
          <AlertCircle size={16} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {images.length > 0 && (
        <div className="w-full flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {images.length} Image{images.length !== 1 ? "s" : ""} selected
            </h3>
            <button
              onClick={() => setImages([])}
              className="text-xs text-red-500 hover:text-red-600 font-medium"
            >
              Clear All
            </button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={images.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                {images.map((item) => (
                  <SortableImageItem
                    key={item.id}
                    item={item}
                    onRemove={removeImage}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="mt-2">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              PDF File Name
            </label>
            <input
              type="text"
              value={pdfName}
              onChange={(e) => setPdfName(e.target.value)}
              placeholder="converted-images"
              className="w-full bg-slate-50 dark:bg-[#0d1117] text-slate-800 dark:text-slate-100 text-sm px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <button
            onClick={generatePDF}
            disabled={isGenerating || images.length === 0}
            className={`mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-white transition-all shadow-sm ${
              isGenerating || images.length === 0
                ? "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 active:scale-[0.98]"
            }`}
          >
            {isGenerating ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Download size={18} />
            )}
            {isGenerating ? "Generating PDF..." : "Convert to PDF"}
          </button>
        </div>
      )}
      </div>
    </div>
  );
};
