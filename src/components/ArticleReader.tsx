import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence, useScroll, useSpring } from "motion/react";
import {
  X, Bookmark, Activity,
  ChevronLeft, ChevronRight, Home, Maximize2, ZoomIn, ZoomOut, RotateCcw,
  Image as ImageIcon, Download
} from "lucide-react";
import { useStore } from "../store/useStore";
import { useNavigationStack } from "../hooks/useNavigationStack";
import { HistoryEntry } from "../types/navigation";
import { downloadImage } from "../utils/downloadUtils";

interface ArticleReaderProps {
  activeArticle: any;
  setActiveArticle: (val: any) => void;
  loadArticle: (title: string) => Promise<any>;
  toggleSaveArticle: (result: any) => void;
  savedArticles: any[];
  language: string;
}

// Memoized Article Content to prevent expensive re-renders during scroll
const ArticleContent = React.memo(({ title, description, html, heroImage, onHeroClick }: {
  title: string,
  description?: string,
  html: string,
  heroImage?: any,
  onHeroClick: (src: string) => void
}) => {
  const processedHtml = useMemo(() => {
    if (!html) return "";
    return html.replace(/<img /g, '<img crossorigin="anonymous" ');
  }, [html]);

  return (
    <div className="max-w-[720px] mx-auto pt-12 pb-40 px-6 sm:px-8">
      <div className="mb-12">
        <h1 className="text-4xl sm:text-5xl font-black mb-6 text-slate-900 dark:text-white tracking-tight leading-[1.1]">
          {title}
        </h1>
        {description && (
          <p className="text-xl text-slate-500 dark:text-slate-400 font-medium leading-normal italic border-l-4 border-blue-500/20 pl-6 py-2">
            {description}
          </p>
        )}
      </div>

      {heroImage && !html.includes(heroImage.source) && (
        <figure className="mb-14 group">
          <div
            className="rounded-3xl overflow-hidden shadow-2xl bg-slate-100 dark:bg-slate-900 aspect-video md:aspect-[16/10] cursor-zoom-in group-hover:scale-[1.01] transition-transform duration-500 border border-slate-100 dark:border-slate-800"
            onClick={() => onHeroClick(heroImage.source)}
          >
            <img
              src={heroImage.source}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        </figure>
      )}

      <div
        className="wikipedia-content-html content-renderer prose-slate dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />
    </div>
  );
});

ArticleContent.displayName = "ArticleContent";

// Dedicated component to handle article scrolling and progress to avoid hydration errors and unnecessary re-renders
function ArticleStage({ currentEntry, push, updateCurrent, navigateToArticle, scrollRef }: {
  currentEntry: HistoryEntry,
  push: (e: any) => void,
  updateCurrent: (e: any) => void,
  navigateToArticle: (t: string) => Promise<void>,
  scrollRef: React.RefObject<HTMLDivElement | null>
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Local scroll tracking for progress bar
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Handle article state restoration
  useEffect(() => {
    if (scrollRef.current) {
      const timer = setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = currentEntry.scrollPosition || 0;
        }
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [currentEntry.id]);

  const handleLinkClick = async (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Check for images first
    const img = target.closest('img');
    if (img && currentEntry?.type === "article") {
      e.preventDefault();
      e.stopPropagation();

      const src = img.getAttribute('src');
      if (src) {
        const allImgs = Array.from(contentRef.current?.querySelectorAll('img') || []);
        const imgUrls = allImgs.map(i => i.getAttribute('src')).filter(Boolean) as string[];
        const currentIndex = imgUrls.indexOf(src);

        push({
          type: "image",
          id: src,
          title: "Image Preview",
          data: {
            src,
            gallery: imgUrls,
            index: currentIndex
          },
          scrollPosition: 0
        });
        return;
      }
    }

    const anchor = target.closest('a');
    if (anchor) {
      const href = anchor.getAttribute('href');
      if (href?.startsWith('/wiki/') || href?.startsWith('./')) {
        e.preventDefault();
        let title = href.replace('/wiki/', '').replace('./', '');
        title = decodeURIComponent(title).replace(/_/g, ' ');
        if (title.includes('#')) {
          const [mainTitle, anchorId] = title.split('#');
          if (mainTitle === currentEntry?.id || !mainTitle) {
            const el = document.getElementById(anchorId);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
            return;
          }
          title = mainTitle;
        }

        if (title) {
          // Store scroll position before navigating
          if (scrollRef.current) {
            updateCurrent({ scrollPosition: scrollRef.current.scrollTop });
          }
          await navigateToArticle(title);
        }
      }
    }
  };

  useEffect(() => {
    const container = contentRef.current;
    if (container) {
      container.addEventListener('click', handleLinkClick);
    }
    return () => {
      if (container) {
        container.removeEventListener('click', handleLinkClick);
      }
    };
  }, [currentEntry.id, push, updateCurrent]);

  return (
    <div className="absolute inset-0 flex flex-col min-h-0 overflow-hidden">
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-slate-50 dark:bg-white/5 z-40">
        <motion.div
          className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] origin-left"
          style={{ scaleX }}
        />
      </div>

      <motion.div
        key={currentEntry.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="flex-1 relative overflow-y-auto custom-scrollbar scroll-smooth"
        ref={scrollRef}
      >
        <div ref={contentRef}>
          {currentEntry.data?.isLoading && !currentEntry.data?.html && (
            <div className="max-w-[720px] mx-auto pt-12 pb-40 px-6 sm:px-8">
              <div className="mb-12 space-y-4">
                <div className="h-10 w-2/3 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
                <div className="h-6 w-full bg-slate-50 dark:bg-slate-800/50 animate-pulse rounded-lg" />
              </div>
              <div className="space-y-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="space-y-3">
                    <div className="h-4 w-full bg-slate-100 dark:bg-slate-800/30 animate-pulse rounded" />
                    <div className="h-4 w-[92%] bg-slate-100 dark:bg-slate-800/30 animate-pulse rounded" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentEntry.data?.html && (
            <ArticleContent
              title={currentEntry.data.title}
              description={currentEntry.data.description}
              html={currentEntry.data.html}
              heroImage={currentEntry.data.thumbnail}
              onHeroClick={(src) => {
                push({
                  type: "image",
                  id: src,
                  title: "Hero Image",
                  data: { src },
                  scrollPosition: 0
                });
              }}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}

export function ArticleReader({ activeArticle, setActiveArticle, loadArticle, toggleSaveArticle, savedArticles, language }: ArticleReaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    navState,
    currentEntry,
    push,
    back,
    forward,
    goToHome,
    goToIndex,
    clear,
    updateCurrent,
    canGoBack,
    canGoForward
  } = useNavigationStack();

  // On mount or when activeArticle changes from outside, initialize the stack
  useEffect(() => {
    if (activeArticle) {
      const isNewArticle = navState.stack.length === 0 ||
        (currentEntry?.type === "article" && currentEntry.id !== activeArticle.title);

      if (isNewArticle) {
        // If it's a completely new article from outside (e.g. search click)
        if (navState.stack.length === 0) {
          push({
            type: "article",
            id: activeArticle.title,
            title: activeArticle.title,
            data: activeArticle,
            scrollPosition: 0
          });
        }
      } else if (currentEntry?.type === "article" && currentEntry.id === activeArticle.title) {
        // Update the current entry if activeArticle finished loading
        if (activeArticle.html && !currentEntry.data?.html) {
          updateCurrent({ data: activeArticle });
        }
      }
    }
  }, [activeArticle, push, navState.stack.length, currentEntry?.id, currentEntry?.type, updateCurrent, currentEntry?.data?.html]);

  const navigateToArticle = async (title: string) => {
    // Eagerly push placeholder
    push({
      type: "article",
      id: title,
      title: title,
      data: { title: title, isLoading: true, html: "" },
      scrollPosition: 0
    });

    setIsLoading(true);
    try {
      const data = await loadArticle(title);
      if (data) {
        updateCurrent({ data: data });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (navState.currentIndex > 0) {
      back();
    } else {
      setActiveArticle(null);
      clear();
    }
  };

  if (navState.stack.length === 0) return null;

  return (
    <div className="absolute inset-0 z-50 flex justify-end overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => { setActiveArticle(null); clear(); }}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />

      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
        className="relative w-full h-full bg-slate-50 dark:bg-[#0B1120] shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        {/* Minimal Nav Header */}
        <div className="flex-none h-14 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/50 px-4 flex items-center justify-between gap-4 z-50">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                if (currentEntry?.type === "article" && scrollRef.current) {
                  updateCurrent({ scrollPosition: scrollRef.current.scrollTop });
                }
                back();
              }}
              disabled={!canGoBack}
              className={`p-2 rounded-full transition-all ${canGoBack ? 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-700 opacity-40'}`}
              title="Back"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => {
                if (currentEntry?.type === "article" && scrollRef.current) {
                  updateCurrent({ scrollPosition: scrollRef.current.scrollTop });
                }
                forward();
              }}
              disabled={!canGoForward}
              className={`p-2 rounded-full transition-all ${canGoForward ? 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-700 opacity-40'}`}
              title="Forward"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={goToHome}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all text-slate-700 dark:text-slate-200 opacity-60 hover:opacity-100"
              title="Home"
            >
              <Home size={16} />
            </button>
          </div>

          <div className="flex-1 flex items-center gap-1.5 overflow-hidden">
            <div className="flex items-center gap-1 text-[13px] font-medium text-slate-400 dark:text-slate-500 overflow-hidden whitespace-nowrap">
              <span className="hidden sm:inline-block cursor-pointer hover:text-blue-500" onClick={goToHome}>Wikipedia</span>
              {navState.stack.slice(Math.max(0, navState.currentIndex - 1), navState.currentIndex + 1).map((entry, idx, arr) => (
                <React.Fragment key={idx}>
                  <span className="opacity-40">/</span>
                  <span
                    className={`truncate max-w-[120px] md:max-w-[200px] cursor-pointer transition-colors ${idx === arr.length - 1 ? "text-slate-900 dark:text-white font-semibold" : "hover:text-blue-500"}`}
                    onClick={() => {
                      const actualIdx = navState.stack.findIndex(e => e === entry);
                      if (actualIdx !== -1) {
                        if (currentEntry?.type === "article" && scrollRef.current) {
                          updateCurrent({ scrollPosition: scrollRef.current.scrollTop });
                        }
                        goToIndex(actualIdx);
                      }
                    }}
                  >
                    {entry.title}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {currentEntry?.type === "article" && (
              <button
                onClick={() => toggleSaveArticle({ title: currentEntry.id, thumbnail: currentEntry.data?.thumbnail?.source })}
                className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all ${savedArticles.find(a => a.title === currentEntry.id) ? 'text-blue-500' : 'text-slate-400'}`}
              >
                <Bookmark size={16} fill={savedArticles.find(a => a.title === currentEntry.id) ? "currentColor" : "none"} />
              </button>
            )}
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-800/50 mx-1" />
            <button
              onClick={handleClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full transition-all"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Dynamic Content Area */}
        <div className="flex-1 relative bg-white dark:bg-[#0B1120] min-h-0 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 bg-white/40 dark:bg-[#0B1120]/40 backdrop-blur-[1px] flex items-center justify-center"
              >
                <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <Activity size={18} className="text-blue-500 animate-spin" />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Fetching Content</span>
                </div>
              </motion.div>
            )}

            {currentEntry?.type === "article" ? (
              <ArticleStage
                key={currentEntry.id}
                currentEntry={currentEntry}
                push={push}
                updateCurrent={updateCurrent}
                navigateToArticle={navigateToArticle}
                scrollRef={scrollRef}
              />
            ) : currentEntry?.type === "image" ? (
              <ImageViewer key="gallery-viewer" entry={currentEntry} back={back} updateCurrent={updateCurrent} />
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { 
          background: rgba(148, 163, 184, 0.2); 
          border-radius: 20px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(148, 163, 184, 0.4); }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(255, 255, 255, 0.2); }

        .wikipedia-content-html {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          font-size: 1.125rem;
          line-height: 1.75;
          color: #334155;
        }
        .dark .wikipedia-content-html { color: #cbd5e1; }

        .wikipedia-content-html .mw-editsection { display: none !important; }
        .wikipedia-content-html p { margin-bottom: 2rem; }
        .wikipedia-content-html a { color: #3b82f6; text-decoration: none; font-weight: 500; border-bottom: 1px solid transparent; transition: all 0.2s; }
        .wikipedia-content-html a:hover { border-bottom-color: currentColor; }
        .wikipedia-content-html img { max-width: 100%; height: auto; border-radius: 12px; cursor: zoom-in; margin: 2rem 0; }
        
        .wikipedia-content-html table { 
          width: 100% !important; 
          border-collapse: separate; 
          border-spacing: 0;
          margin: 3rem 0; 
          border: 1px solid rgba(148, 163, 184, 0.1); 
          font-size: 0.875rem; 
          border-radius: 16px;
          overflow: hidden;
          display: block;
          overflow-x: auto;
        }
        .wikipedia-content-html th { background: rgba(148, 163, 184, 0.03); padding: 16px; text-align: left; border: 1px solid rgba(148, 163, 184, 0.1); font-weight: 700; }
        .wikipedia-content-html td { padding: 16px; border: 1px solid rgba(148, 163, 184, 0.1); vertical-align: top; }
        
        .wikipedia-content-html .infobox { 
          border: 1px solid rgba(148, 163, 184, 0.1); 
          background: rgba(148, 163, 184, 0.02); 
          padding: 24px; 
          border-radius: 24px; 
          float: right; 
          clear: right; 
          margin: 0 0 2rem 2.5rem; 
          width: 340px; 
          font-size: 0.8125rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
        }
        @media (max-width: 640px) {
          .wikipedia-content-html .infobox {
            float: none;
            width: 100%;
            margin-left: 0;
            padding: 16px;
          }
        }
        .dark .wikipedia-content-html .infobox { background: rgba(255, 255, 255, 0.02); }

        .wikipedia-content-html h2 { font-size: 2rem; font-weight: 900; margin-top: 5rem; margin-bottom: 2rem; color: #0f172a; tracking: -0.02em; border-top: 1px solid rgba(148, 163, 184, 0.1); pt-12; }
        .dark .wikipedia-content-html h2 { color: #f8fafc; }
        
        .wikipedia-content-html h3 { font-size: 1.5rem; font-weight: 800; margin-top: 3.5rem; margin-bottom: 1.5rem; color: #1e293b; }
        .dark .wikipedia-content-html h3 { color: #f1f5f9; }

        .wikipedia-content-html ul, .wikipedia-content-html ol { padding-left: 1.5rem; margin-bottom: 2rem; list-style-type: disc; }
        .wikipedia-content-html li { margin-bottom: 0.75rem; }
        
        @media (max-width: 800px) {
           .wikipedia-content-html .infobox { float: none; width: 100%; margin: 0 0 3rem 0; padding: 20px; }
           .wikipedia-content-html { font-size: 1.0625rem; }
           .wikipedia-content-html h2 { font-size: 1.75rem; }
        }
      `}} />
    </div>
  );
}

function ImageViewer({ entry, back, updateCurrent }: { entry: HistoryEntry, back: () => void, updateCurrent: (u: any) => void }) {
  const setNotification = useStore((state) => state.setNotification);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const touchStartDist = useRef<number | null>(null);
  const initialZoom = useRef<number>(1);
  const lastTouch = useRef({ x: 0, y: 0 });
  const lastTap = useRef(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Robust gallery state: use the initial gallery from entry, but keep it stable
  const initialGallery = useRef(entry.data?.gallery || [entry.data?.src]);
  const gallery = initialGallery.current;
  const [currentIndex, setCurrentIndex] = useState(entry.data?.index || 0);
  const src = gallery[currentIndex];

  // Sync current index back to navigation stack to survive re-renders
  useEffect(() => {
    updateCurrent({ data: { ...entry.data, index: currentIndex } });
  }, [currentIndex]);

  // Auto-scroll carousel
  useEffect(() => {
    if (carouselRef.current) {
      const activeButton = carouselRef.current.children[currentIndex] as HTMLElement;
      if (activeButton) {
        activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      touchStartDist.current = dist;
      initialZoom.current = zoom;
    } else if (e.touches.length === 1) {
      if (zoom > 1) {
        setIsPanning(true);
        lastTouch.current = { x: e.touches[0].pageX, y: e.touches[0].pageY };
      }

      // Custom double tap detection using ref instead of window
      const now = Date.now();
      if (now - lastTap.current < 300) {
        handleDoubleTap();
      }
      lastTap.current = now;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const scale = dist / touchStartDist.current;
      // Adaptive zoom sensitivity
      const newZoom = Math.min(5, Math.max(1, initialZoom.current * scale));
      setZoom(newZoom);
      if (newZoom <= 1.05) {
        setPan({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isPanning && zoom > 1) {
      const deltaX = e.touches[0].pageX - lastTouch.current.x;
      const deltaY = e.touches[0].pageY - lastTouch.current.y;
      setPan(p => ({ x: p.x + deltaX, y: p.y + deltaY }));
      lastTouch.current = { x: e.touches[0].pageX, y: e.touches[0].pageY };
    }
  };

  const handleTouchEnd = () => {
    touchStartDist.current = null;
    setIsPanning(false);
  };

  const handleDoubleTap = () => {
    if (zoom > 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(2.5);
    }
  };

  const handleNext = () => {
    if (currentIndex < gallery.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
    }
  };

  const handleDownloadInternal = async (url: string) => {
    const success = await downloadImage(url);
    if (success) {
      setNotification({ message: "Image downloaded", type: "success" });
    } else {
      setNotification({ message: "Failed to download image", type: "error" });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "Escape") back();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, gallery.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-slate-950 z-[200] flex flex-col overflow-hidden"
    >
      {/* Overlay Toolbar - Ultra Clean & Responsive */}
      <div className="flex-none h-14 sm:h-20 bg-gradient-to-b from-black/80 to-transparent px-4 sm:px-8 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 bg-blue-600 rounded-xl shrink-0 shadow-lg shadow-blue-500/20">
            <ImageIcon size={16} className="text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] opacity-50 truncate">Media Explorer</span>
            <span className="text-xs font-black text-white/90 tracking-widest">{currentIndex + 1} <span className="opacity-40">/</span> {gallery.length}</span>
          </div>
        </div>

        {/* Controls Overlay */}
        <div className="flex items-center gap-1 sm:gap-2 bg-white/5 backdrop-blur-3xl p-1 sm:p-1.5 rounded-2xl border border-white/10 shadow-2xl">
          <button
            onClick={() => {
              const nextZoom = Math.max(1, zoom - 0.5);
              setZoom(nextZoom);
              if (nextZoom <= 1.05) setPan({ x: 0, y: 0 });
            }}
            className="p-1.5 sm:p-2 hover:bg-white/10 rounded-xl text-white/80 active:scale-90 transition-all shrink-0"
          >
            <ZoomOut size={18} />
          </button>
          <button onClick={() => setZoom(z => Math.min(5, z + 0.5))} className="p-1.5 sm:p-2 hover:bg-white/10 rounded-xl text-white/80 active:scale-90 transition-all shrink-0">
            <ZoomIn size={18} />
          </button>
          <div className="w-px h-5 bg-white/10 mx-0.5 sm:mx-1" />
          <button onClick={() => setRotation(r => r + 90)} className="p-1.5 sm:p-2 hover:bg-white/10 rounded-xl text-white/80 active:scale-90 transition-all shrink-0">
            <RotateCcw size={18} />
          </button>
          <button onClick={() => { setZoom(1); setRotation(0); setPan({ x: 0, y: 0 }); }} className="p-1.5 sm:p-2 hover:bg-white/10 rounded-xl text-white/80 active:scale-90 transition-all shrink-0" title="Reset View">
            <Maximize2 size={18} />
          </button>
          <div className="w-px h-5 bg-white/10 mx-0.5 sm:mx-1" />
          <button
            onClick={() => handleDownloadInternal(src)}
            className="p-1.5 sm:p-2 hover:bg-white/10 rounded-xl text-white/80 active:scale-90 transition-all shrink-0"
            title="Download Image"
          >
            <Download size={18} />
          </button>
        </div>

        <button onClick={back} className="p-2 sm:p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all active:scale-90 shrink-0">
          <X size={18} />
        </button>
      </div>

      {/* Main Stage - Centered & Responsive */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center p-2 sm:p-4 touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleTap}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={src}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{
              opacity: 1,
              scale: zoom,
              rotate: rotation,
              x: pan.x,
              y: pan.y
            }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{
              opacity: { duration: 0.15 },
              scale: { type: "spring", damping: 25, stiffness: 350, mass: 0.4 },
              rotate: { type: "spring", damping: 25, stiffness: 200 },
              x: { type: "tween", ease: "linear", duration: 0 },
              y: { type: "tween", ease: "linear", duration: 0 }
            }}
            className="w-full h-full flex items-center justify-center pointer-events-none"
          >
            <img
              src={src}
              crossOrigin="anonymous"
              className="max-w-full max-h-full object-contain select-none shadow-[0_0_120px_rgba(0,0,0,0.6)]"
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>

        {/* Nav Buttons Container - Controlled visibility */}
        <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2 sm:px-6 pointer-events-none z-10 transition-opacity duration-300 ${zoom > 1.05 ? "opacity-0" : "opacity-100"}`}>
          <button
            disabled={currentIndex === 0}
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className={`w-10 sm:w-14 h-10 sm:h-14 flex items-center justify-center rounded-2xl bg-black/50 text-white border border-white/10 shadow-2xl backdrop-blur-xl transition-all pointer-events-auto ${currentIndex === 0 ? "opacity-0 scale-50 pointer-events-none" : "hover:bg-blue-600 hover:border-blue-500 hover:scale-110 active:scale-95"}`}
          >
            <ChevronLeft size={24} />
          </button>
          <button
            disabled={currentIndex === gallery.length - 1}
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className={`w-10 sm:w-14 h-10 sm:h-14 flex items-center justify-center rounded-2xl bg-black/50 text-white border border-white/10 shadow-2xl backdrop-blur-xl transition-all pointer-events-auto ${currentIndex === gallery.length - 1 ? "opacity-0 scale-50 pointer-events-none" : "hover:bg-blue-600 hover:border-blue-500 hover:scale-110 active:scale-95"}`}
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {/* Modern Thumbnail Strip - Sticky & Stable */}
      {gallery.length > 1 && (
        <div className="flex-none pb-4 sm:pb-8 pt-2 px-4 w-full z-50">
          <div className="max-w-4xl mx-auto h-16 sm:h-24 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl">
            <div
              ref={carouselRef}
              className="flex gap-2 sm:gap-3 overflow-x-auto no-scrollbar h-full items-center px-3 sm:px-6 snap-x snap-mandatory"
            >
              {gallery.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentIndex(idx);
                    setZoom(1);
                    setRotation(0);
                    setPan({ x: 0, y: 0 });
                  }}
                  className={`snap-center shrink-0 relative h-10 sm:h-16 aspect-video rounded-lg sm:rounded-xl overflow-hidden border-2 transition-all duration-300 ${idx === currentIndex ? "border-blue-500 ring-2 ring-blue-500/20 scale-100" : "border-transparent opacity-30 hover:opacity-100 scale-90"}`}
                >
                  <img src={img} crossOrigin="anonymous" className="w-full h-full object-cover" />
                  {idx === currentIndex && (
                    <motion.div
                      layoutId="activeThumb"
                      className="absolute inset-0 bg-blue-500/10"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

