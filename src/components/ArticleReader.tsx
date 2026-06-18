import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { X, Bookmark, ExternalLink, Activity, Info, List as ListIcon } from "lucide-react";
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
      <div 
        className="fixed inset-0 z-[100] flex justify-end"
      >
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setActiveArticle(null)}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="relative w-full max-w-[800px] h-full bg-slate-50 dark:bg-[#0B1120] shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800"
        >
          {/* Simple Top Bar */}
          <div className="flex-none bg-white/80 dark:bg-[#151D2C]/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-3 flex items-center justify-between z-20 shadow-sm relative">
            <div 
              className="absolute bottom-0 left-0 h-0.5 bg-blue-500 transition-all duration-100" 
              style={{ width: `${readingProgress}%` }}
            />
            
            <div className="flex items-center gap-3 overflow-hidden">
              <button 
                onClick={() => setActiveArticle(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 shrink-0"
                title="Close"
              >
                <X size={24} />
              </button>
              <div className="opacity-0 transition-opacity flex-1 truncate" id="article-scrolled-title">
                 <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{title}</h3>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <button 
                onClick={() => toggleSaveArticle({ title: title, thumbnail: thumbnail?.source })} 
                className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors ${savedArticles.find(a => a.title === title) ? 'text-blue-500' : 'text-slate-500'}`}
              >
                <Bookmark size={20} fill={savedArticles.find(a => a.title === title) ? "currentColor" : "none"} />
              </button>
              <a href={content_urls?.desktop?.page} target="_blank" rel="noreferrer" className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full flex items-center justify-center transition-colors">
                <ExternalLink size={20} />
              </a>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar" ref={scrollRef} onScroll={handleScroll}>
            <div className="max-w-[720px] mx-auto min-h-screen bg-white dark:bg-[#0F1623] shadow-md border-x border-slate-200 dark:border-slate-800 px-6 sm:px-10 md:px-12 py-10 pb-32" ref={contentRef}>
              
              {/* Hero Section */}
              <h1 className="text-3xl md:text-5xl font-extrabold mb-5 text-slate-900 dark:text-white leading-tight">
                {title}
              </h1>
              
              {description && (
                <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 mt-0 mb-8 font-medium leading-relaxed border-l-4 border-blue-500/50 pl-4 bg-blue-50/50 dark:bg-blue-900/10 py-3 pr-2 rounded-r-xl">
                  {description}
                </p>
              )}

              {thumbnail?.source && (
                <figure className="mb-10 w-full mt-6 scale-[1.02]">
                  <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 aspect-video md:aspect-[16/9]">
                    <img src={thumbnail.source} className="w-full h-full object-cover m-0" />
                  </div>
                </figure>
              )}

              {/* Table of Contents */}
              {sections?.length > 1 && (
                <div className="mb-12 p-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800/50">
                   <div className="flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 font-bold text-lg">
                     <ListIcon size={20} className="text-blue-500" /> Table of Contents
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

              <div 
                className="mt-6 font-sans text-[1.05rem] md:text-[1.125rem] leading-[1.7] text-slate-800 dark:text-slate-200 wikipedia-content-html" 
                dangerouslySetInnerHTML={{ __html: html }} 
              />
            </div>
          </div>

          <style dangerouslySetInnerHTML={{__html:`
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.3); }

            .wikipedia-content-html .mw-editsection { display: none !important; }
            .wikipedia-content-html p { margin-bottom: 1.5em; }
            .wikipedia-content-html table { width: 100% !important; overflow-x: auto; display: block; border-collapse: collapse; margin: 2rem 0; border-radius: 8px; font-size: 0.9rem; border: 1px solid rgba(148, 163, 184, 0.2); }
            .wikipedia-content-html th { background: rgba(59, 130, 246, 0.05); padding: 12px 16px; border: 1px solid rgba(148, 163, 184, 0.2); text-align: left; }
            .wikipedia-content-html td { padding: 12px 16px; border: 1px solid rgba(148, 163, 184, 0.2); }
            .wikipedia-content-html .infobox { border: 1px solid rgba(148, 163, 184, 0.3); background: rgba(148, 163, 184, 0.03); padding: 20px; border-radius: 16px; float: right; clear: right; margin: 0 0 1.5em 2em; max-width: 300px; font-size: 0.85rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .wikipedia-content-html .infobox img { max-width: 100%; height: auto; border-radius: 8px; margin-bottom: 12px; }
            .wikipedia-content-html .hatnote { font-style: italic; color: #64748b; margin-bottom: 1.5em; font-size: 0.95em; border-left: 2px solid #cbd5e1; padding-left: 12px; }
            .wikipedia-content-html .thumb { margin-bottom: 2rem; border: 1px solid rgba(148, 163, 184, 0.1); border-radius: 12px; overflow: hidden; }
            .wikipedia-content-html .thumbinner { background: rgba(148, 163, 184, 0.03); padding: 12px; }
            .wikipedia-content-html .thumbcaption { font-size: 0.85em; color: #64748b; padding-top: 10px; line-height: 1.5; }
            .wikipedia-content-html a { text-decoration: none; color: #3b82f6; font-weight: 500; }
            .wikipedia-content-html a:hover { text-decoration: underline; }
            .wikipedia-content-html h2 { font-size: 1.5rem; font-weight: 700; margin-top: 2rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(148, 163, 184, 0.2); }
            .wikipedia-content-html h3 { font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.75rem; }
            .wikipedia-content-html ul, .wikipedia-content-html ol { padding-left: 1.5em; margin-bottom: 1.5em; }
            .wikipedia-content-html li { margin-bottom: 0.5em; }
            
            .dark .wikipedia-content-html a { color: #60a5fa; }
            .dark .wikipedia-content-html .hatnote { color: #94a3b8; border-color: #475569; }
            .dark .wikipedia-content-html blockquote { border-color: #475569; color: #cbd5e1; }
            
            @media (max-width: 1024px) {
               .wikipedia-content-html .infobox { float: none; max-width: 100%; margin: 0 0 2em 0; }
            }
          `}} />
        </motion.div>
      </div>
  );
}
