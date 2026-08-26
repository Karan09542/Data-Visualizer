import React, { useState, useRef } from "react";
import { FileImage, Download, Trash2, GripVertical, AlertCircle, Eye } from "lucide-react";
import { PDFDocument, PageSizes } from "pdf-lib";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import MediaCarousel from "../MediaCarousel";
import { InteractiveZoomImage } from "../InteractiveZoomImage";

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
}

interface ImageItemCardProps {
  item: ImageItem;
  onRemove?: (id: string) => void;
  onPreview?: () => void;
  dragHandleProps?: any;
  isDragging?: boolean;
  isOverlay?: boolean;
}

const ImageItemCard: React.FC<ImageItemCardProps> = ({
  item,
  onRemove,
  onPreview,
  dragHandleProps,
  isDragging,
  isOverlay,
}) => {
  return (
    <div
      className={`flex items-center justify-between p-3 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl transition-all ${
        isOverlay
          ? "shadow-2xl ring-2 ring-blue-500 scale-[1.02] cursor-grabbing z-50"
          : isDragging
          ? "opacity-30 border-dashed border-blue-400 dark:border-blue-500"
          : "shadow-sm hover:border-slate-300 dark:hover:border-slate-700"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          {...dragHandleProps}
          style={{ touchAction: "none" }}
          className="p-2 -ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg cursor-grab active:cursor-grabbing touch-none select-none transition-colors shrink-0"
          title="Drag to reorder"
          aria-label="Drag to reorder"
        >
          <GripVertical size={18} />
        </div>
        
        <button
          type="button"
          onClick={onPreview}
          className="relative group/thumb w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          title="Click to view image preview"
        >
          <img
            src={item.previewUrl}
            alt={item.file.name}
            className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-200 select-none"
            draggable={false}
          />
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white pointer-events-none">
            <Eye size={16} />
          </div>
        </button>

        <div 
          className="flex flex-col min-w-0 flex-1 cursor-pointer group/info"
          onClick={onPreview}
        >
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover/info:text-blue-600 dark:group-hover/info:text-blue-400 transition-colors" title={item.file.name}>
            {item.file.name}
          </span>
          <span className="text-xs text-slate-400">
            {(item.file.size / 1024 / 1024).toFixed(2)} MB
          </span>
        </div>
      </div>
      
      {onRemove && !isOverlay && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.id);
          }}
          className="p-2 ml-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
          title="Remove image"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
};

const SortableImageItem = ({
  item,
  onRemove,
  onPreview,
}: {
  item: ImageItem;
  onRemove: (id: string) => void;
  onPreview: () => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ImageItemCard
        item={item}
        onRemove={onRemove}
        onPreview={onPreview}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
};

export const ImageToPdfConverter = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfName, setPdfName] = useState("converted-images");
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 8,
      },
    }),
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    setActiveId(null);
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
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        
        let imgBuffer: Uint8Array;
        let isJpg = img.file.type === "image/jpeg" || img.file.type === "image/jpg";
        let isPng = img.file.type === "image/png";

        if (isJpg || isPng) {
          const arrayBuffer = await img.file.arrayBuffer();
          imgBuffer = new Uint8Array(arrayBuffer);
        } else {
          // Convert other formats (e.g. WebP) to PNG using Canvas
          const imgObj = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.src = img.previewUrl;
            image.onload = () => resolve(image);
            image.onerror = reject;
          });
          const canvas = document.createElement('canvas');
          canvas.width = imgObj.width;
          canvas.height = imgObj.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(imgObj, 0, 0);
          const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
          const arrayBuffer = await blob.arrayBuffer();
          imgBuffer = new Uint8Array(arrayBuffer);
          isPng = true;
        }

        const pdfImage = isJpg ? await pdfDoc.embedJpg(imgBuffer) : await pdfDoc.embedPng(imgBuffer);

        const page = pdfDoc.addPage(PageSizes.A4);
        const { width: pageWidth, height: pageHeight } = page.getSize();

        const margin = 20;
        const availableWidth = pageWidth - (margin * 2);
        const availableHeight = pageHeight - (margin * 2);

        const imgDims = pdfImage.scaleToFit(availableWidth, availableHeight);

        // Center on page
        const x = margin + (availableWidth - imgDims.width) / 2;
        const y = margin + (availableHeight - imgDims.height) / 2;

        page.drawImage(pdfImage, {
          x,
          y,
          width: imgDims.width,
          height: imgDims.height,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${pdfName || "converted-images"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
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
              onClick={() => {
                images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
                setImages([]);
                setCarouselIndex(null);
              }}
              className="text-xs text-red-500 hover:text-red-600 font-medium"
            >
              Clear All
            </button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext
              items={images.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                {images.map((item, index) => (
                  <SortableImageItem
                    key={item.id}
                    item={item}
                    onRemove={removeImage}
                    onPreview={() => setCarouselIndex(index)}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={{ duration: 150, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
              {activeId ? (
                <ImageItemCard
                  item={images.find((i) => i.id === activeId)!}
                  isOverlay
                />
              ) : null}
            </DragOverlay>
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
      
      <MediaCarousel
        isOpen={carouselIndex !== null}
        onClose={() => setCarouselIndex(null)}
        items={images}
        selectedIndex={carouselIndex ?? 0}
        onIndexChange={setCarouselIndex}
        keepMounted={false}
        renderHeaderMiddle={(item, index, total) => (
          <>
            <p className="text-sm sm:text-base font-bold mb-0.5 truncate w-full px-4 text-center">
              {item.file.name}
            </p>
            <div className="flex items-center justify-center gap-2 opacity-80 text-[10px] sm:text-xs font-medium uppercase tracking-wider">
              <span>{(item.file.size / 1024 / 1024).toFixed(2)} MB</span>
              <span className="w-1 h-1 rounded-full bg-white/50 shrink-0" />
              <span>
                {index + 1} / {total}
              </span>
            </div>
          </>
        )}
        renderHeaderRight={(item, index) => (
          <div className="flex items-center gap-2">
            <a
              href={item.previewUrl}
              download={item.file.name}
              onClick={(e) => e.stopPropagation()}
              className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md flex items-center justify-center"
              title="Download Image"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeImage(item.id);
                if (images.length <= 1) {
                  setCarouselIndex(null);
                } else if (index >= images.length - 1) {
                  setCarouselIndex(images.length - 2);
                }
              }}
              className="p-2 sm:p-3 bg-red-600/80 hover:bg-red-600 text-white rounded-full transition-all backdrop-blur-md flex items-center justify-center"
              title="Remove from PDF list"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
        renderItem={(item) => (
          <div className="w-full h-full flex items-center justify-center p-2 sm:p-6 pointer-events-auto">
            <InteractiveZoomImage
              src={item.previewUrl}
              alt={item.file.name}
              className="rounded-xl shadow-2xl bg-slate-900/50"
            />
          </div>
        )}
      />
    </div>
  );
};
