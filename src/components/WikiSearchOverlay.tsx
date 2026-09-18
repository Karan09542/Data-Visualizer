import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, X, Loader2, Maximize2, Minimize2, ChevronLeft, Globe,
  FileText, Image as ImageIcon, Check, Clock, ExternalLink, Wand2, Plus,
} from "lucide-react";
import MediaCarousel from "./MediaCarousel";
import { db } from "../lib/db";
import { useStore } from "../store/useStore";
import { useInsertNode } from "../hooks/useInsertNode";
import {
  buildSearchPlan, splitSections, WIKI_LANGUAGES,
  type ArticleSection,
} from "../utils/wikiSearch";

/** History is no longer scoped to a node, so every search shares one bucket. */
const HISTORY_KEY = "global_wiki_search";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Hit {
  title: string;
  snippet: string;
  /** Filled by a second pass, since list=search does not return images. */
  thumbnail?: string;
}

interface WikiImage {
  title: string;
  url: string;
  width: number;
  height: number;
  /** Size before thumbnailing, used only to weed out icons. */
  originalWidth: number;
}

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "");

/**
 * A stable colour per title, so an article without a picture still gets something to
 * recognise it by, and the same article looks the same on every search.
 */
const accentFor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue} 68% 55%), hsl(${(hue + 38) % 360} 68% 45%))`;
};

/** Heading depth shown as colour, so nesting is readable without deep indentation. */
const LEVEL_ACCENT = [
  "border-l-blue-500",
  "border-l-violet-500",
  "border-l-amber-500",
  "border-l-emerald-500",
  "border-l-rose-500",
];

export function WikiSearchOverlay({ open, onClose }: Props) {
  const setNotification = useStore((s) => s.setNotification);
  const insertNode = useInsertNode();

  const [inputValue, setInputValue] = useState("");
  const [language, setLanguage] = useState(
    () => localStorage.getItem("wiki_search_lang") || "en",
  );
  // A phone has no room for a floating panel, so it starts filled and keeps no toggle.
  const [expanded, setExpanded] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 639px)").matches,
  );

  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [rewritten, setRewritten] = useState<string | null>(null);

  const [article, setArticle] = useState<string | null>(null);
  const [sections, setSections] = useState<ArticleSection[]>([]);
  const [images, setImages] = useState<WikiImage[]>([]);
  const [loadingArticle, setLoadingArticle] = useState(false);

  const [history, setHistory] = useState<string[]>([]);
  const [justInserted, setJustInserted] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  /** Guards against a slow response overwriting a newer one. */
  const seq = useRef(0);

  useEffect(() => {
    localStorage.setItem("wiki_search_lang", language);
  }, [language]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    db.nodeSearchHistory
      .where("storageKey").equals(HISTORY_KEY)
      .toArray()
      .then((rows) => {
        const seen = new Set<string>();
        const recent = rows
          .sort((a: any, b: any) => b.timestamp - a.timestamp)
          .map((r: any) => r.query as string)
          .filter((q) => (seen.has(q) ? false : (seen.add(q), true)))
          .slice(0, 6);
        setHistory(recent);
      })
      .catch(() => {});
    return () => clearTimeout(t);
  }, [open]);

  /** Esc steps back out of the overlay one layer at a time rather than closing outright. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // This listener captures, so the carousel's own Escape never reaches it. Closing the
      // carousel here keeps the innermost thing the one that goes first.
      e.stopPropagation();
      if (carouselIndex !== null) setCarouselIndex(null);
      else if (article) setArticle(null);
      else if (expanded) setExpanded(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, article, expanded, carouselIndex, onClose]);

  const runSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q) return;

      const mine = ++seq.current;
      setSearching(true);
      setSearched(true);
      setArticle(null);

      const plan = buildSearchPlan(q);
      setRewritten(plan.wasRewritten ? plan.query : null);

      try {
        const res = await fetch(
          `https://${language}.wikipedia.org/w/api.php?action=query&list=search` +
            `&srsearch=${encodeURIComponent(plan.query)}&srlimit=20&srprop=snippet` +
            `&utf8=&format=json&origin=*`,
        );
        const data = await res.json();
        if (mine !== seq.current) return;

        const found: Hit[] = (data?.query?.search || []).map((h: any) => ({
          title: h.title,
          snippet: stripHtml(h.snippet || ""),
        }));
        setHits(found);

        // Thumbnails come from a second call, because list=search returns text only.
        // It is fire-and-forget: results are already on screen, pictures fill in after.
        if (found.length > 0) {
          const titles = found.slice(0, 20).map((h) => h.title).join("|");
          fetch(
            `https://${language}.wikipedia.org/w/api.php?action=query&prop=pageimages` +
              `&piprop=thumbnail&pithumbsize=160&titles=${encodeURIComponent(titles)}` +
              `&format=json&origin=*`,
          )
            .then((r) => r.json())
            .then((thumbData) => {
              if (mine !== seq.current) return;
              const byTitle = new Map<string, string>();
              for (const page of Object.values<any>(thumbData?.query?.pages || {})) {
                if (page?.thumbnail?.source) byTitle.set(page.title, page.thumbnail.source);
              }
              if (byTitle.size === 0) return;
              setHits((prev) =>
                prev.map((h) => ({ ...h, thumbnail: byTitle.get(h.title) || h.thumbnail })),
              );
            })
            .catch(() => {});
        }

        db.nodeSearchHistory
          .add({ storageKey: HISTORY_KEY, query: q, timestamp: Date.now() } as any)
          .catch(() => {});
        setHistory((prev) => [q, ...prev.filter((p) => p !== q)].slice(0, 6));
      } catch {
        if (mine === seq.current) setHits([]);
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    },
    [language],
  );

  const openArticle = useCallback(
    async (title: string) => {
      setArticle(title);
      setLoadingArticle(true);
      setSections([]);
      setImages([]);

      const base = `https://${language}.wikipedia.org/w/api.php`;
      try {
        const [extractRes, imageRes] = await Promise.all([
          fetch(
            `${base}?action=query&prop=extracts&explaintext=1&redirects=1` +
              `&titles=${encodeURIComponent(title)}&format=json&origin=*`,
          ),
          // iiurlwidth asks for a thumbnail too: the originals run to several thousand
          // pixels and multiple megabytes, which is not what belongs in a node
          fetch(
            `${base}?action=query&generator=images&gimlimit=30&prop=imageinfo` +
              `&iiprop=url|size&iiurlwidth=1024&titles=${encodeURIComponent(title)}` +
              `&format=json&origin=*`,
          ),
        ]);

        const extractData = await extractRes.json();
        const pages = extractData?.query?.pages || {};
        const page: any = Object.values(pages)[0];
        setSections(page?.extract ? splitSections(page.extract) : []);

        const imageData = await imageRes.json();
        const imagePages: any[] = Object.values(imageData?.query?.pages || {});
        setImages(
          imagePages
            .map((p) => {
              const info = p.imageinfo?.[0] || {};
              return {
                title: p.title as string,
                // Commons hands back "….jpg?utm_source=…", so the tracking tail is dropped
                url: String(info.thumburl || info.url || "").split("?")[0],
                width: info.thumbwidth || info.width || 0,
                height: info.thumbheight || info.height || 0,
                originalWidth: info.width || 0,
              };
            })
            // Icons, logos and maintenance badges ride along with every article. The
            // extension is tested on the title, since the URL no longer ends with it.
            .filter(
              (i) =>
                i.url &&
                /\.(jpe?g|png|webp)$/i.test(i.title) &&
                i.originalWidth >= 150 &&
                !/logo|icon|commons-|wiki(media|quote|source)|edit-|question_book|ambox|symbol_/i.test(i.title),
            ),
        );
      } catch {
        setSections([]);
      } finally {
        setLoadingArticle(false);
      }
    },
    [language],
  );

  const flash = (id: string) => {
    setJustInserted(id);
    setTimeout(() => setJustInserted((v) => (v === id ? null : v)), 1400);
  };

  const insertText = async (section: ArticleSection) => {
    const name = section.title === "Summary" ? article! : `${article} ${section.title}`;
    const path = await insertNode({ name, value: section.text, kind: "text" });
    if (path) {
      flash(`s:${section.title}`);
      setNotification?.({ type: "success", message: `Inserted "${section.title}" as a text node` });
    }
  };

  const insertImage = async (img: WikiImage) => {
    const path = await insertNode({ name: img.title, value: img.url, kind: "image" });
    if (path) {
      flash(`i:${img.title}`);
      setNotification?.({ type: "success", message: "Inserted as an image node" });
    }
  };

  if (!open) return null;

  // Filling the screen means filling the backdrop exactly, so the panel measures itself
  // against its parent rather than the viewport: w-screen is 100vw, which overshoots
  // whenever a vertical scrollbar is taking up room.
  const panelSize = expanded
    ? "w-full h-full max-w-none rounded-none border-0"
    : "w-full h-full rounded-none sm:w-[min(940px,94vw)] sm:h-[min(760px,88dvh)] sm:rounded-2xl";

  return createPortal(
    <>
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        // Above the toolbar, which sits at z-[500] with its mobile menu at z-[510].
        // MediaCarousel lives at z-[12000] and so still opens over this.
        // The desktop inset is dropped while expanded, or the panel could never reach the edges.
        className={`fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm ${
          expanded ? "p-0" : "p-0 sm:p-4"
        }`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !expanded) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className={`${panelSize} flex flex-col overflow-hidden bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-800 shadow-2xl`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* ── Search bar: stays put so a new search is always one click away ── */}
          <div className="shrink-0 flex items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#151D2C]">
            {article && (
              <button
                onClick={() => setArticle(null)}
                title="Back to results"
                className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 dark:text-slate-400"
              >
                <ChevronLeft size={18} />
              </button>
            )}

            <div className="relative flex-1 min-w-0">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSearch(inputValue);
                }}
                placeholder="Search Wikipedia"
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-500"
              />
            </div>

            <div className="relative shrink-0">
              <Globe
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                title="Wikipedia edition"
                className="h-9 pl-8 pr-2 w-[104px] sm:w-auto rounded-lg bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
              >
                {WIKI_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Restore size" : "Fill the screen"}
              aria-pressed={expanded}
              className="h-9 w-9 shrink-0 hidden sm:flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 dark:text-slate-400"
            >
              {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>

            <button
              onClick={onClose}
              title="Close (Esc)"
              className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-500 dark:text-slate-400"
            >
              <X size={18} />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {article ? (
              <ArticleView
                title={article}
                language={language}
                loading={loadingArticle}
                sections={sections}
                images={images}
                justInserted={justInserted}
                onInsertText={insertText}
                onInsertImage={insertImage}
                onOpenImage={setCarouselIndex}
              />
            ) : (
              <ResultsView
                hits={hits}
                searching={searching}
                searched={searched}
                rewritten={rewritten}
                history={history}
                onPick={openArticle}
                onRunHistory={(q) => {
                  setInputValue(q);
                  runSearch(q);
                }}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>

    {/* The app's own viewer, so a Wikipedia picture behaves like any other image here */}
    <MediaCarousel
      isOpen={carouselIndex !== null}
      onClose={() => setCarouselIndex(null)}
      items={images}
      selectedIndex={carouselIndex ?? 0}
      onIndexChange={setCarouselIndex}
      renderItem={(img) => (
        <img
          src={img.url}
          alt={img.title}
          className="max-h-full max-w-full object-contain"
        />
      )}
      renderHeaderMiddle={(img, index, total) => (
        <>
          <p className="text-sm sm:text-base font-black mb-0.5 truncate w-full px-4">
            {img.title.replace(/^File:/, "")}
          </p>
          <div className="flex items-center gap-2 opacity-80 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
            <span className="hidden sm:inline">
              {img.width} × {img.height} px
            </span>
            <span className="w-1 h-1 rounded-full bg-white/50 shrink-0 hidden sm:inline" />
            <span>
              {index + 1} / {total}
            </span>
          </div>
        </>
      )}
      renderHeaderRight={(img) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            insertImage(img);
          }}
          className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5"
        >
          <ImageIcon size={14} /> Insert
        </button>
      )}
    />
    </>,
    document.body,
  );
}

/* ────────────────────────── results ────────────────────────── */

function ResultsView({
  hits, searching, searched, rewritten, history, onPick, onRunHistory,
}: {
  hits: Hit[];
  searching: boolean;
  searched: boolean;
  rewritten: string | null;
  history: string[];
  onPick: (title: string) => void;
  onRunHistory: (q: string) => void;
}) {
  if (searching) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 gap-2">
        <Loader2 size={18} className="animate-spin" /> Searching…
      </div>
    );
  }

  if (!searched) {
    return (
      <div className="p-8 flex flex-col items-center text-center gap-5">
        <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
          <Search size={26} className="text-blue-500" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            Search Wikipedia, keep what you need
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
            Pick an article, then add any section as a text node or any picture as an image node.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm">
            Plain words are enough. <code className="font-mono text-blue-500">intitle:</code> and{" "}
            <code className="font-mono text-blue-500">incategory:</code> work too.
          </p>
        </div>

        {history.length > 0 && (
          <div className="w-full max-w-md text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Clock size={12} /> Recent
            </p>
            <div className="flex flex-wrap gap-2">
              {history.map((q) => (
                <button
                  key={q}
                  onClick={() => onRunHistory(q)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (hits.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Nothing found. Try fewer words, or <code className="font-mono text-blue-500">intitle:</code> to
        match the title only.
      </div>
    );
  }

  return (
    <div className="p-3">
      {rewritten && (
        <p className="px-2 pb-2 text-[11px] text-slate-400 flex items-center gap-1.5">
          <Wand2 size={12} /> Searched as{" "}
          <code className="font-mono text-blue-500">{rewritten}</code>
        </p>
      )}
      <div className="flex flex-col gap-1">
        {hits.map((h) => (
          <button
            key={h.title}
            onClick={() => onPick(h.title)}
            className="flex items-center gap-3 text-left p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors group"
          >
            <div
              className="h-12 w-12 shrink-0 rounded-lg overflow-hidden flex items-center justify-center font-bold text-white text-lg"
              style={h.thumbnail ? undefined : { background: accentFor(h.title) }}
            >
              {h.thumbnail ? (
                <img
                  src={h.thumbnail}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                h.title.charAt(0).toUpperCase()
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[15px] text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                {h.title}
              </p>
              {h.snippet && (
                <p className="text-[13px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                  {h.snippet}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────── article ────────────────────────── */

function ArticleView({
  title, language, loading, sections, images, justInserted,
  onInsertText, onInsertImage, onOpenImage,
}: {
  title: string;
  language: string;
  loading: boolean;
  sections: ArticleSection[];
  images: WikiImage[];
  justInserted: string | null;
  onInsertText: (s: ArticleSection) => void;
  onInsertImage: (i: WikiImage) => void;
  onOpenImage: (index: number) => void;
}) {
  const [open, setOpen] = useState<string | null>("Summary");

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 gap-2">
        <Loader2 size={18} className="animate-spin" /> Loading article…
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{title}</h2>
        <a
          href={`https://${language}.wikipedia.org/wiki/${encodeURIComponent(title)}`}
          target="_blank"
          rel="noreferrer"
          title="Open on Wikipedia"
          className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ExternalLink size={15} />
        </a>
      </div>

      {/* ── Sections ── */}
      <section className="flex flex-col gap-1.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Sections · {sections.length}
        </h3>

        {sections.map((s) => {
          const isOpen = open === s.title;
          const inserted = justInserted === `s:${s.title}`;
          return (
            <div
              key={s.title}
              className={`rounded-xl border border-l-4 border-slate-200 dark:border-slate-800 overflow-hidden ${
                LEVEL_ACCENT[Math.min(s.level - 2, LEVEL_ACCENT.length - 1)]
              }`}
              style={{ marginLeft: (s.level - 2) * 14 }}
            >
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-[#151D2C]">
                <button
                  onClick={() => setOpen(isOpen ? null : s.title)}
                  className="flex-1 text-left text-sm font-medium text-slate-700 dark:text-slate-200 truncate"
                >
                  {s.title}
                </button>
                <span className="text-[11px] text-slate-400 shrink-0 hidden sm:block">
                  {s.text.length.toLocaleString()} chars
                </span>
                <button
                  onClick={() => onInsertText(s)}
                  className={`shrink-0 h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                    inserted
                      ? "bg-emerald-500 text-white"
                      : "bg-blue-600 hover:bg-blue-500 text-white"
                  }`}
                >
                  {inserted ? <Check size={13} /> : <FileText size={13} />}
                  {inserted ? "Added" : "Text"}
                </button>
              </div>

              {isOpen && (
                <p className="px-3 py-2.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400 whitespace-pre-wrap max-h-52 overflow-y-auto border-t border-slate-200 dark:border-slate-800">
                  {s.text}
                </p>
              )}
            </div>
          );
        })}

        {sections.length === 0 && (
          <p className="text-sm text-slate-400 py-2">No readable sections in this article.</p>
        )}
      </section>

      {/* ── Images ── */}
      {images.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Images · {images.length}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {images.map((img, idx) => {
              const inserted = justInserted === `i:${img.title}`;
              return (
                <div
                  key={img.title}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-black/40"
                >
                  {/*
                    object-cover, so every tile is the same shape however tall or wide the
                    original is. Nothing is lost: the tile opens the full picture in the viewer.
                  */}
                  <button
                    onClick={() => onOpenImage(idx)}
                    title="Open in the viewer"
                    className="absolute inset-0 h-full w-full cursor-zoom-in"
                  >
                    <img
                      src={img.url}
                      alt={img.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </button>

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2.5 pb-2 pt-7">
                    <p className="text-[10px] font-medium text-white/90 truncate">
                      {img.title.replace(/^File:/, "")}
                    </p>
                  </div>

                  {/* Always visible on touch, where there is no hover to reveal it */}
                  <button
                    onClick={() => onInsertImage(img)}
                    title="Insert as an image node"
                    className={`absolute top-2 right-2 h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ${
                      inserted
                        ? "bg-emerald-500 text-white sm:opacity-100"
                        : "bg-white/95 text-slate-800 hover:bg-blue-600 hover:text-white"
                    }`}
                  >
                    {inserted ? <Check size={13} /> : <Plus size={13} />}
                    {inserted ? "Added" : "Add"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
