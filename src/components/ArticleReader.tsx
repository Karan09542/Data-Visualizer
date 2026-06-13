import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, Bookmark, ExternalLink, Activity, Info, List as ListIcon } from "lucide-react";
import { useStore } from "../store/useStore";

interface ArticleReaderProps {
  activeArticle: any;
  setActiveArticle: (val: any) => void;
  loadArticle: (title: string) => void;
  toggleSaveArticle: (result: any) => void;
  savedArticles: any[];
}

export function ArticleReader({ activeArticle, setActiveArticle, loadArticle, toggleSaveArticle, savedArticles }: ArticleReaderProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [readingProgress, setReadingProgress] = useState(0);

  const title = activeArticle?.title;
  const description = activeArticle?.description;
  const thumbnail = activeArticle?.thumbnail;
  const content_urls = activeArticle?.content_urls;
  const html = activeArticle?.html || "";
  const sections = activeArticle?.sections || [];

  useEffect(() => {
    // Intercept Wikipedia clicks
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href?.startsWith('/wiki/') || href?.startsWith('./')) {
          e.preventDefault();
          let title = href.replace('/wiki/', '').replace('./', '');
          title = decodeURIComponent(title).replace(/_/g, ' ');
          if (title.includes('#')) title = title.split('#')[0];
          if (title) {
            loadArticle(title);
          }
        }
      }
    };

    const container = contentRef.current;
    if (container) {
      container.addEventListener('click', handleLinkClick);
    }
    return () => {
      if (container) {
        container.removeEventListener('click', handleLinkClick);
      }
    };
  }, [activeArticle, loadArticle]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const progress = (target.scrollTop / (target.scrollHeight - target.clientHeight)) * 100;
    setReadingProgress(progress);
    
    // Toggle header title opacity
    const titleObj = document.getElementById("article-scrolled-title");
    if (titleObj) {
      if (target.scrollTop > 150) {
        titleObj.style.opacity = "1";
      } else {
        titleObj.style.opacity = "0";
      }
    }
  };

  if (!activeArticle) return null;

  return (
      <motion.div 
        initial={{ opacity: 0, y: 50, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-0 z-[100] bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-xl flex flex-col"
      >
        {/* Simple Top Bar */}
        <div className="flex-none bg-white/80 dark:bg-[#151D2C]/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-3 flex items-center justify-between z-20 shadow-sm relative">
          <div 
            className="absolute bottom-0 left-0 h-0.5 bg-blue-500 transition-all duration-100" 
            style={{ width: `${readingProgress}%` }}
          />
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveArticle(null)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="opacity-0 transition-opacity flex-1 max-w-[200px] md:max-w-md truncate" id="article-scrolled-title">
               <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{title}</h3>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => toggleSaveArticle({ title: title, thumbnail: thumbnail?.source })} className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors ${savedArticles.find(a => a.id === title) ? 'text-blue-500' : 'text-slate-500'}`}>
              <Bookmark size={20} fill={savedArticles.find(a => a.id === title) ? "currentColor" : "none"} />
            </button>
            <a href={content_urls?.desktop?.page} target="_blank" rel="noreferrer" className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full flex items-center justify-center transition-colors">
              <ExternalLink size={20} />
            </a>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" ref={scrollRef} onScroll={handleScroll}>
          <div className="max-w-[720px] mx-auto min-h-screen bg-white dark:bg-[#0F1623] shadow-2xl border-x border-slate-200 dark:border-slate-800 px-6 sm:px-12 md:px-16 py-12 pb-32" ref={contentRef}>
            
            {/* Hero Section */}
            <h1 className="text-4xl md:text-5xl font-extrabold mb-5 text-slate-900 dark:text-white leading-tight font-serif">
              {title}
            </h1>
            
            {description && (
              <p className="text-xl text-slate-500 dark:text-slate-400 mt-0 mb-8 font-medium leading-relaxed border-l-4 border-slate-200 dark:border-slate-700 pl-4">
                {description}
              </p>
            )}

            {thumbnail?.source && (
              <figure className="mb-12 w-full mt-8">
                <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                  <img src={thumbnail.source} className="w-full h-auto object-cover max-h-[60vh] m-0" />
                </div>
              </figure>
            )}

            {/* Table of Contents */}
            {sections?.length > 1 && (
              <div className="mb-12 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                 <div className="flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 font-bold text-lg">
                   <ListIcon size={20} /> Table of Contents
                 </div>
                 <div className="flex flex-col gap-2">
                   {sections.filter((s: any) => s.toclevel === 1 || s.toclevel === 2).map((sec: any) => (
                      <a 
                        key={sec.index || sec.anchor}
                        href={`#${sec.anchor}`}
                        onClick={(e) => {
                           e.preventDefault();
                           const el = document.getElementById(sec.anchor);
                           if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className={`text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm ${sec.toclevel === 2 ? 'ml-4' : 'font-medium'}`}
                      >
                         {sec.line}
                      </a>
                   ))}
                 </div>
              </div>
            )}

            {/* Quick Facts / TOC sidebar could be injected here, but for now linear flow is good */}

            <div 
              className="mt-6 font-serif text-[1.125rem] md:text-[1.25rem] leading-[1.8] text-slate-800 dark:text-slate-200 wikipedia-content-html" 
              dangerouslySetInnerHTML={{ __html: html }} 
            />
          </div>

          <style dangerouslySetInnerHTML={{__html:`
            .wikipedia-content-html .mw-editsection { display: none !important; }
            .wikipedia-content-html p { margin-bottom: 1.5em; }
            .wikipedia-content-html table { width: 100% !important; overflow-x: auto; display: block; border-collapse: collapse; margin: 2rem 0; border-radius: 8px; font-sans: true; font-size: 0.95rem; }
            .wikipedia-content-html th { background: rgba(59, 130, 246, 0.05); padding: 12px 16px; border: 1px solid rgba(148, 163, 184, 0.2); text-align: left; }
            .wikipedia-content-html td { padding: 12px 16px; border: 1px solid rgba(148, 163, 184, 0.2); }
            .wikipedia-content-html th.infobox-label { width: 35%; font-weight: 600; color: inherit; }
            .wikipedia-content-html .infobox { border: 1px solid rgba(148, 163, 184, 0.3); background: rgba(148, 163, 184, 0.03); padding: 20px; border-radius: 16px; float: right; clear: right; margin: 0 0 1.5em 2em; max-width: 320px; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 0.9rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .wikipedia-content-html .infobox img { max-width: 100%; height: auto; border-radius: 8px; margin-bottom: 12px; }
            .wikipedia-content-html .hatnote { font-style: italic; color: #64748b; margin-bottom: 1.5em; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 0.95em; border-left: 2px solid #cbd5e1; padding-left: 12px; }
            .wikipedia-content-html .thumb { margin-bottom: 1.5rem; }
            .wikipedia-content-html .thumbinner { border: 1px solid rgba(148, 163, 184, 0.2); background: rgba(148, 163, 184, 0.03); padding: 10px; border-radius: 12px; }
            .wikipedia-content-html .thumbcaption { font-size: 0.85em; color: #64748b; padding-top: 10px; line-height: 1.5; font-family: ui-sans-serif, system-ui, sans-serif; }
            .wikipedia-content-html a { text-decoration: none; color: #2563eb; font-weight: 500; border-bottom: 1px solid transparent; transition: border-color 0.2s; }
            .wikipedia-content-html a:hover { border-bottom-color: #2563eb; }
            .wikipedia-content-html h1, .wikipedia-content-html h2, .wikipedia-content-html h3, .wikipedia-content-html h4 { font-family: ui-sans-serif, system-ui, sans-serif; }
            .wikipedia-content-html ul, .wikipedia-content-html ol { padding-left: 1.5em; margin-bottom: 1.5em; }
            .wikipedia-content-html li { margin-bottom: 0.5em; }
            .wikipedia-content-html blockquote { border-left: 4px solid #cbd5e1; padding-left: 1em; margin-left: 0; font-style: italic; color: #475569; }
            @media (prefers-color-scheme: dark) {
               .wikipedia-content-html a { color: #60a5fa; }
               .wikipedia-content-html a:hover { border-bottom-color: #60a5fa; }
               .wikipedia-content-html .hatnote { color: #94a3b8; border-color: #475569; }
               .wikipedia-content-html blockquote { border-color: #475569; color: #cbd5e1; }
            }
            @media (max-width: 768px) {
               .wikipedia-content-html .infobox { float: none; max-width: 100%; margin: 0 0 2em 0; }
            }
          `}} />
        </div>
      </motion.div>
  );
}
