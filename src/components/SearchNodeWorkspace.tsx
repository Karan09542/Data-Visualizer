import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Search, X, Clock, MapPin, ExternalLink, Image as ImageIcon, 
  BookOpen, ChevronLeft, LayoutGrid, List, Maximize, Bookmark, ChevronRight,
  History, Users, Layers, Activity, SlidersHorizontal, Moon, Sun, Info, Globe, Menu, ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useStore } from "../store/useStore";
import { db } from "../lib/db";
import { liveQuery } from "dexie";
import { getValueAtPath } from "../utils/pathUtils";
import get from "lodash.get";

import { ArticleReader } from "./ArticleReader";

interface SearchWorkspaceProps {
  path: string;
}

type ActiveTab = "All" | "Images" | "Articles" | "People" | "Places" | "Categories" | "Timeline";

const languages = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "ja", name: "日本語" },
  { code: "hi", name: "हिन्दी (Hindi)" },
  { code: "sa", name: "संस्कृतम् (Sanskrit)" },
  { code: "ta", name: "தமிழ் (Tamil)" },
  { code: "te", name: "తెలుగు (Telugu)" },
  { code: "mr", name: "मराठी (Marathi)" },
  { code: "gu", name: "ગુજરાતી (Gujarati)" },
  { code: "ar", name: "العربية (Arabic)" },
  { code: "zh", name: "中文 (Chinese)" },
  { code: "ru", name: "Русский (Russian)" }
];

export function SearchNodeWorkspace({ path }: SearchWorkspaceProps) {
  const { updateNodeValue, code } = useStore();
  const [query, setQuery] = useState(() => sessionStorage.getItem(`${path}_query`) || "");
  const [inputValue, setInputValue] = useState(() => sessionStorage.getItem(`${path}_query`) || "");
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => (sessionStorage.getItem(`${path}_tab`) as ActiveTab) || "All");
  const [language, setLanguage] = useState(() => localStorage.getItem('wiki_lang') || "en");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [activeSidebarItem, setActiveSidebarItem] = useState(() => sessionStorage.getItem(`${path}_sidebar`) || "All Results");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  // Close language dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // States
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>(() => JSON.parse(sessionStorage.getItem(`${path}_results`) || "[]"));
  const [imageResults, setImageResults] = useState<any[]>(() => JSON.parse(sessionStorage.getItem(`${path}_imageResults`) || "[]"));
  const [isSearching, setIsSearching] = useState(false);
  const [activeArticle, setActiveArticle] = useState<any | null>(() => JSON.parse(sessionStorage.getItem(`${path}_article`) || "null"));
  
  // Knowledge Panel
  const [knowledgePanel, setKnowledgePanel] = useState<any | null>(() => JSON.parse(sessionStorage.getItem(`${path}_kp`) || "null"));

  // Pagination
  const [offset, setOffset] = useState(() => parseInt(sessionStorage.getItem(`${path}_offset`) || "0"));
  const [totalHits, setTotalHits] = useState(() => parseInt(sessionStorage.getItem(`${path}_totalHits`) || "0"));
  const [searchTime, setSearchTime] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  const [lastSearchedQuery, setLastSearchedQuery] = useState(() => sessionStorage.getItem(`${path}_last_searched_query`) || "");

  // Persistence Hook
  useEffect(() => {
    sessionStorage.setItem(`${path}_query`, query);
    sessionStorage.setItem(`${path}_last_searched_query`, lastSearchedQuery);
    sessionStorage.setItem(`${path}_tab`, activeTab);
    sessionStorage.setItem(`${path}_sidebar`, activeSidebarItem);
    sessionStorage.setItem(`${path}_results`, JSON.stringify(results));
    sessionStorage.setItem(`${path}_imageResults`, JSON.stringify(imageResults));
    sessionStorage.setItem(`${path}_kp`, JSON.stringify(knowledgePanel));
    sessionStorage.setItem(`${path}_article`, JSON.stringify(activeArticle));
    sessionStorage.setItem(`${path}_offset`, offset.toString());
    sessionStorage.setItem(`${path}_totalHits`, totalHits.toString());
    localStorage.setItem('wiki_lang', language);
  }, [path, query, lastSearchedQuery, activeTab, activeSidebarItem, results, imageResults, knowledgePanel, activeArticle, offset, totalHits, language]);

  const storageKey = useMemo(() => {
    try {
      const parsed = JSON.parse(code);
      let nodeValue = getValueAtPath(parsed, path);
      
      if (typeof nodeValue === 'string' && nodeValue.startsWith('{')) {
        try { nodeValue = JSON.parse(nodeValue); } catch {}
      }
      
      if (typeof nodeValue === 'object' && nodeValue?.storageKey) {
        return nodeValue.storageKey;
      }
    } catch {}
    return null;
  }, [code, path]);

  // Persistence
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [savedArticles, setSavedArticles] = useState<any[]>([]);

  useEffect(() => {
    if (!storageKey) return;
    
    let active = true;
    const historySub = liveQuery(() =>
      db.nodeSearchHistory
        .where('storageKey')
        .equals(storageKey)
        .toArray()
        .then(arr => arr.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10))
    ).subscribe({
      next: (result) => {
        if (!active) return;
        setTimeout(() => { if (active) setSearchHistory(result || []); }, 0);
      }
    });

    const savedSub = liveQuery(() =>
      db.nodeSearchBookmarks
        .where('storageKey')
        .equals(storageKey)
        .toArray()
        .then(arr => arr.sort((a, b) => b.timestamp - a.timestamp))
    ).subscribe({
      next: (result) => {
        if (!active) return;
        setTimeout(() => { if (active) setSavedArticles(result || []); }, 0);
      }
    });

    return () => {
      active = false;
      historySub.unsubscribe();
      savedSub.unsubscribe();
    };
  }, [storageKey]);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') !== 'light';
  });

  // Theme support
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Debounced search for suggestions
  useEffect(() => {
    if (!inputValue.trim() || !isFocused) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://${language}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(inputValue)}&limit=8&namespace=0&format=json&origin=*`);
        const data = await res.json();
        setSuggestions(data[1] || []);
      } catch (err) {
        console.error(err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [inputValue, isFocused]);

  // Auto-search on mount if query provided and either no results or different query
  useEffect(() => {
    if (query && (results.length === 0 || query !== lastSearchedQuery) && !isSearching) {
      executeSearch(query);
    }
  }, []);

  // Listen for query update events from the SearchNodeRenderer
  useEffect(() => {
    const handleQueryUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string; query: string }>;
      if (customEvent.detail && customEvent.detail.path === path) {
        setQuery(customEvent.detail.query);
        setInputValue(customEvent.detail.query);
        executeSearch(customEvent.detail.query);
      }
    };

    window.addEventListener("search_node_query_updated", handleQueryUpdate as EventListener);
    return () => {
      window.removeEventListener("search_node_query_updated", handleQueryUpdate as EventListener);
    };
  }, [path]);

  const executeSearch = async (overrideQuery?: string, newOffset: number = 0, langOverride?: string, tabOverride?: ActiveTab) => {
    const q = overrideQuery !== undefined ? overrideQuery : inputValue;
    const currentTab = tabOverride || activeTab;
    // Sidebar item might be stale if tabOverride was just set
    const currentSidebar = tabOverride === "Images" ? "Images" : (tabOverride === "Articles" ? "Articles" : (tabOverride === "All" ? "All Results" : activeSidebarItem));
    
    if (!q.trim()) {
      setQuery("");
      setInputValue("");
      setResults([]);
      setImageResults([]);
      setKnowledgePanel(null);
      setHasMore(false);
      setActiveArticle(null);
      setTotalHits(0);
      setOffset(0);
      setSearchTime(0);
      setSuggestions([]);
      setLastSearchedQuery("");
      setIsSearching(false);
      
      sessionStorage.removeItem(`${path}_query`);
      sessionStorage.removeItem(`${path}_last_searched_query`);
      sessionStorage.removeItem(`${path}_results`);
      sessionStorage.removeItem(`${path}_imageResults`);
      sessionStorage.removeItem(`${path}_kp`);
      sessionStorage.removeItem(`${path}_article`);
      sessionStorage.removeItem(`${path}_offset`);
      sessionStorage.removeItem(`${path}_totalHits`);
      
      return;
    }
    
    setQuery(q);
    setInputValue(q);
    setLastSearchedQuery(q);
    setIsFocused(false);
    setIsSearching(true);
    setOffset(newOffset);
    
    // If searching from Sidebar types like Saved/History, move back to All Results
    if (activeSidebarItem === 'Saved' || activeSidebarItem === 'History') {
       if (!tabOverride) {
         setActiveSidebarItem('All Results');
         setActiveTab('All');
       }
    }
    
    const startTime = performance.now();

    if (newOffset === 0) {
      setKnowledgePanel(null);
      setActiveArticle(null);
      setResults([]);
      setImageResults([]);
      setHasMore(true);
    }

    try {
      if (storageKey) {
        const historyArr = await db.nodeSearchHistory.where('storageKey').equals(storageKey).toArray();
        const existing = historyArr.find(h => h.query === q);
        if (!existing || !existing.isPinned) {
           if (existing) await db.nodeSearchHistory.delete(existing.id!);
           await db.nodeSearchHistory.add({ storageKey, query: q, timestamp: Date.now() });
        }
      }
    } catch(err) {}

    try {
      if (currentSidebar === "Images" || currentTab === "Images") {
        // Image search
        const res = await fetch(`https://${langOverride || language}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&prop=imageinfo&iiprop=url|extmetadata|size|dimensions&format=json&origin=*&gsrlimit=${limit}&gsroffset=${newOffset}`);
        const data = await res.json();
        const pages = Object.values(data?.query?.pages || {});
        setImageResults(prev => newOffset === 0 ? pages as any[] : [...prev, ...pages as any[]]);
        setHasMore(pages.length === limit);
      } else {
        // Article search
        let modifiedQuery = q;
        if (currentTab === "People") modifiedQuery += " person";
        if (currentTab === "Places") modifiedQuery += " location";

        const res = await fetch(`https://${langOverride || language}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(modifiedQuery)}&utf8=&format=json&origin=*&srlimit=${limit}&sroffset=${newOffset}&srprop=snippet|titlesnippet|size|wordcount|timestamp`);
        const data = await res.json();
        const hits = data?.query?.search || [];
        setTotalHits(data?.query?.searchinfo?.totalhits || 0);

        // Fetch thumbnails for top hits
        const titles = hits.slice(0, 10).map((h: any) => h.title).join('|');
        if (titles) {
          const thumbRes = await fetch(`https://${langOverride || language}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=pageimages|categories&piprop=thumbnail&pithumbsize=300&format=json&origin=*`);
          const thumbData = await thumbRes.json();
          const pages = thumbData?.query?.pages || {};
          
          hits.forEach((hit: any) => {
            const pid = Object.values(pages).find((p: any) => p.title === hit.title) as any;
            if (pid) {
              hit.thumbnail = pid.thumbnail?.source;
              hit.categories = pid.categories?.slice(0, 3).map((c: any) => c.title.replace('Category:', '')) || [];
            }
          });
        }
        
        setResults(prev => newOffset === 0 ? hits : [...prev, ...hits]);
        setHasMore(hits.length === limit);

        // Fetch knowledge panel if exact match (only on first page)
        if (newOffset === 0 && hits.length > 0) {
           const exactMatch = hits[0].title.toLowerCase() === q.toLowerCase();
           if (exactMatch || hits[0].snippet.includes(q)) {
             try {
               const kpRes = await fetch(`https://${langOverride || language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hits[0].title)}`);
               if (kpRes.ok) {
                 const kpData = await kpRes.json();
                 if (kpData.type !== 'disambiguation') {
                    try {
                      const relatedRes = await fetch(`https://${langOverride || language}.wikipedia.org/api/rest_v1/page/related/${encodeURIComponent(hits[0].title)}`);
                      if (relatedRes.ok) {
                        const relatedData = await relatedRes.json();
                        kpData.related = relatedData.pages?.slice(0, 4) || [];
                      }
                    } catch (e) {}
                    kpData.categories = hits[0].categories;
                    kpData.timestamp = hits[0].timestamp;
                    kpData.wordcount = hits[0].wordcount;
                    setKnowledgePanel(kpData);
                 }
               }
             } catch(err) {}
           }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchTime(Number(((performance.now() - startTime) / 1000).toFixed(2)));
      setIsSearching(false);
    }
  };

  const loadArticle = async (title: string, langOverride?: string, preliminaryData?: any) => {
    // If we have preliminary data (title, summary, thumbnail), set it immediately to show the viewer
    if (preliminaryData) {
      setActiveArticle({
        title: preliminaryData.title || title,
        description: preliminaryData.description || "",
        extract: preliminaryData.summary || preliminaryData.snippet || "",
        thumbnail: preliminaryData.thumbnail ? (typeof preliminaryData.thumbnail === 'string' ? { source: preliminaryData.thumbnail } : preliminaryData.thumbnail) : null,
        html: "",
        sections: [],
        isLoading: true
      });
    }

    try {
      const lang = langOverride || language;
      const [summaryRes, parseRes] = await Promise.all([
         fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`),
         fetch(`https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text|sections&format=json&origin=*`)
      ]);
      
      const summaryData = summaryRes.ok ? await summaryRes.json() : {};
      const parseData = parseRes.ok ? await parseRes.json() : {};
      
      const articleData = {
         title: summaryData.title || title,
         description: summaryData.description || "",
         extract: summaryData.extract || "",
         thumbnail: summaryData.thumbnail || null,
         content_urls: summaryData.content_urls || null,
         html: parseData.parse?.text?.["*"] || "",
         sections: parseData.parse?.sections || [],
         isLoading: false
      };

      setActiveArticle(articleData);
      return articleData;
    } catch(err) {
      console.error(err);
      return null;
    }
  };

  const toggleSaveArticle = async (result: any) => {
     if (!storageKey) return;
     try {
       // Find if it exists locally to toggle it
       const articles = await db.nodeSearchBookmarks.where('storageKey').equals(storageKey).toArray();
       const existing = articles.find(a => a.title === result.title);
       
       if (existing) {
         await db.nodeSearchBookmarks.delete(existing.id!);
       } else {
         await db.nodeSearchBookmarks.add({
           storageKey,
           collectionId: "default",
           title: result.title,
           summary: (result.snippet || result.description || result.extract || "").replace(/<\/?[^>]+(>|$)/g, ""),
           thumbnail: result.thumbnail?.source || (typeof result.thumbnail === 'string' ? result.thumbnail : null),
           timestamp: Date.now()
         });
       }
     } catch(err) {
       console.error(err);
     }
  };

  const handleTabClick = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === "Images") setActiveSidebarItem("Images");
    else if (tab === "Articles") setActiveSidebarItem("Articles");
    else setActiveSidebarItem("All Results");
    setHasMore(true);

    if (query) executeSearch(query, 0, undefined, tab);
  };

  const handleSidebarClick = (item: string) => {
    setActiveSidebarItem(item);
    let tab: ActiveTab = activeTab;
    if (item === "Images") tab = "Images";
    else if (item === "Articles") tab = "Articles";
    else if (item === "All Results") tab = "All";
    
    if (item === "Images" || item === "Articles" || item === "All Results") {
      setActiveTab(tab);
    }
    
    setIsMobileMenuOpen(false);
    setHasMore(true);

    if (query && item !== "Saved" && item !== "History") {
      executeSearch(query, 0, undefined, tab);
    }
  };

  // Components 
  const renderSidebar = () => (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <div className={`
        fixed lg:relative inset-y-0 left-0 z-[210] bg-slate-100 dark:bg-[#0B1120] border-r border-slate-200 dark:border-slate-800 flex flex-col pt-4 overflow-y-auto shrink-0 transition-all duration-300 shadow-2xl lg:shadow-none
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        ${isSidebarCollapsed ? "lg:w-[80px]" : "w-[280px] lg:w-[320px]"}
      `}>
        <div className={`px-5 mb-8 flex items-center ${isSidebarCollapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
              <Search size={22} strokeWidth={2.5} />
            </div>
            {!isSidebarCollapsed && (
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Knowledge</span>
            )}
          </div>
          {!isSidebarCollapsed && (
            <button 
              className="lg:hidden p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5 px-3">
          {[
            { id: 'All Results', icon: Search },
            { id: 'Images', icon: ImageIcon },
            { id: 'Articles', icon: BookOpen },
            { id: 'Saved', icon: Bookmark, badge: savedArticles.length },
            { id: 'History', icon: History }
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => handleSidebarClick(item.id)}
              className={`flex items-center gap-3 rounded-xl transition-all font-bold text-[15px] group
                ${isSidebarCollapsed ? "justify-center p-3" : "px-4 py-3"}
                ${activeSidebarItem === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800/60'}`}
              title={isSidebarCollapsed ? item.id : ""}
            >
              <item.icon size={20} className={`${activeSidebarItem === item.id ? "text-white" : "group-hover:scale-110 transition-transform"}`} />
              {!isSidebarCollapsed && (
                <>
                  <span className="flex-1 text-left">{item.id}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeSidebarItem === item.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

      {!isSidebarCollapsed && (
        <>
          <div className="mt-10 mb-4 px-6 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
            Recent Searches
          </div>
          <div className="flex flex-col gap-0.5 px-3">
            {searchHistory.slice(0, 5).map(h => (
              <button 
                key={h.id}
                onClick={() => {
                  setInputValue(h.query);
                  executeSearch(h.query, 0);
                }}
                className="flex items-center gap-3 px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800/40 rounded-xl transition-all text-sm group text-left truncate"
              >
                <Search size={14} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                <span className="truncate font-medium">{h.query}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-auto p-4 border-t border-slate-200 dark:border-slate-800/50">
        <div 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`flex items-center gap-2 rounded-xl transition-colors cursor-pointer border border-transparent
            ${isSidebarCollapsed ? "justify-center p-2" : "justify-between px-3 py-3 bg-slate-200/50 dark:bg-black/20 hover:bg-slate-200 dark:hover:bg-black/40"}
          `}
          title={isSidebarCollapsed ? (isDarkMode ? 'Light Mode' : 'Dark Mode') : ""}
        >
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {isDarkMode ? <Moon size={14} /> : <Sun size={14} />} 
              {isDarkMode ? 'Dark' : 'Light'}
            </div>
          )}
          {isSidebarCollapsed ? (
             isDarkMode ? <Moon size={20} className="text-blue-500" /> : <Sun size={20} className="text-amber-500" />
          ) : (
            <div className={`w-9 h-5 rounded-full relative transition-colors ${isDarkMode ? 'bg-blue-600 shadow-inner' : 'bg-slate-300 shadow-inner'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-all ${isDarkMode ? 'right-0.5' : 'left-0.5'}`}></div>
            </div>
          )}
        </div>
        
        <button 
          onClick={() => {
            const next = !isSidebarCollapsed;
            setIsSidebarCollapsed(next);
            localStorage.setItem('sidebar_collapsed', String(next));
          }}
          className={`hidden lg:flex items-center gap-3 w-full mt-3 px-4 py-3 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-all font-bold text-xs uppercase tracking-widest
            ${isSidebarCollapsed ? "justify-center" : "justify-start"}
          `}
        >
          {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!isSidebarCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
    </>
  );

  const renderTopBar = () => (
    <div className="w-full bg-slate-100 dark:bg-[#0B1120]/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/80 sticky top-0 z-40 pt-4 px-6 pb-0 flex flex-col">
      <div className="flex items-center justify-between mb-4 gap-6">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-3xl">
          <div className={`flex items-center w-full bg-white dark:bg-[#151D2C] rounded-2xl border transition-all duration-300 shadow-sm
              ${isFocused ? 'border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.2)]' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:border-slate-700'}
          `}>
            <div className="pl-4 pr-2 text-slate-600 dark:text-slate-400">
              <Search size={20} />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
              placeholder="Ask anything or search..."
              className="w-full bg-transparent border-none outline-none py-3.5 text-slate-900 dark:text-slate-100 text-[15px] placeholder:text-slate-500 font-medium"
            />
            {inputValue && (
              <button 
                onClick={() => executeSearch("")} 
                className="p-2 mr-1 text-slate-500 hover:text-slate-700 dark:text-slate-300"
              >
                <X size={18} />
              </button>
            )}
            <button 
              onClick={() => executeSearch()}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-5 py-2 mr-1.5 font-medium transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)] text-sm"
            >
              Search
            </button>
          </div>

          {/* Autocomplete Dropdown */}
          <AnimatePresence>
            {isFocused && (inputValue.trim() || searchHistory.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute top-full mt-2 w-full bg-white dark:bg-[#151D2C] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50"
              >
                <div className="py-2">
                  {!inputValue.trim() ? searchHistory.map((h, i) => (
                    <div 
                      key={i} 
                      onClick={() => executeSearch(h.query)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 cursor-pointer transition-colors text-slate-700 dark:text-slate-300 group"
                    >
                      <History size={16} className="text-slate-500" />
                      <span className="flex-1">{h.query}</span>
                    </div>
                  )) : suggestions.map((s, i) => (
                    <div 
                      key={i} 
                      onClick={() => executeSearch(s)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 cursor-pointer transition-colors text-slate-700 dark:text-slate-300"
                    >
                      <Search size={16} className="text-slate-500" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Menu & Right Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-4">
            <div ref={langDropdownRef} className="relative z-50">
              <button 
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="flex items-center bg-white dark:bg-[#151D2C] border border-slate-200 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl px-3 py-1.5 shadow-sm text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1b2536] transition-all cursor-pointer"
                aria-haspopup="listbox"
                aria-expanded={isLangOpen}
              >
                <Globe size={16} className="text-slate-500 mr-2 shrink-0 animate-pulse" />
                <span className="truncate w-24 text-left select-none">
                  {languages.find(l => l.code === language)?.name || "English"}
                </span>
                <ChevronDown size={14} className={`text-slate-400 ml-2 transition-transform duration-200 shrink-0 ${isLangOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {isLangOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 mt-2 w-56 max-h-80 overflow-y-auto rounded-xl bg-white dark:bg-[#151D2C] border border-slate-200 dark:border-slate-800 shadow-2xl py-1.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
                    role="listbox"
                  >
                    {languages.map((lang) => {
                      const isSelected = language === lang.code;
                      return (
                        <button
                          key={lang.code}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setLanguage(lang.code);
                            setIsLangOpen(false);
                            if (query) {
                              executeSearch(query, 0, lang.code);
                            }
                          }}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between cursor-pointer
                            ${isSelected 
                              ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold" 
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A2333] hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                          <span className="truncate font-sans">{lang.name}</span>
                          {isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-450 shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <button 
              onClick={() => { setActiveSidebarItem("Saved"); setActiveTab("All"); }}
              className={`transition-colors flex items-center gap-2 text-sm font-medium ${activeSidebarItem === "Saved" ? "text-blue-500" : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              <Bookmark size={18} fill={activeSidebarItem === "Saved" ? "currentColor" : "none"} /> Saved
            </button>
          </div>

          <button 
            className="lg:hidden p-2 text-slate-600 dark:text-slate-400 bg-white dark:bg-[#151D2C] border border-slate-200 dark:border-slate-800 rounded-xl"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-6 overflow-x-auto no-scrollbar pb-2">
        {["All", "Images", "Articles", "People", "Places", "Categories", "Timeline"].map((tab) => (
          <button 
            key={tab}
            onClick={() => handleTabClick(tab as ActiveTab)}
            className={`pb-2 font-medium transition-all text-sm relative whitespace-nowrap
              ${activeTab === tab ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}
            `}
          >
            {tab}
            {activeTab === tab && (
              <motion.div layoutId="search-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-500" />
            )}
          </button>
        ))}
      </div>
    </div>
  );

  const renderStats = () => {
    if (!query || activeSidebarItem === "Saved" || isSearching && results.length === 0) return null;
    return (
       <div className="flex justify-between items-center py-4 px-1 border-b border-slate-200 dark:border-slate-800/50 mb-6">
          <div className="text-[13px] text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1.5">
             About {totalHits.toLocaleString()} results ({searchTime}s) <Info size={12} className="opacity-50" />
          </div>
          <div className="flex text-[13px] text-slate-600 dark:text-slate-400 gap-2 items-center">
             Sort by: <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1 cursor-pointer hover:text-white">Relevance <ChevronDown size={14} /></span>
          </div>
       </div>
    )
  }

  const renderResults = () => {
    const list = activeSidebarItem === "Saved" ? savedArticles : results;
    
    if (isSearching && list.length === 0) {
      return (
        <div className="flex flex-col gap-1 w-full max-w-4xl mx-auto">
           {[...Array(5)].map((_, i) => (
             <div key={i} className="py-8 px-2 border-b border-slate-100 dark:border-slate-800/40 flex flex-col sm:flex-row gap-6 animate-pulse">
                <div className="w-full sm:w-44 h-48 sm:h-44 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
                <div className="flex-1 space-y-4 pt-1">
                   <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800/50 rounded" />
                   <div className="h-6 w-3/4 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
                   <div className="space-y-2">
                      <div className="h-4 w-full bg-slate-100 dark:bg-slate-800/50 rounded" />
                      <div className="h-4 w-5/6 bg-slate-100 dark:bg-slate-800/50 rounded" />
                   </div>
                </div>
             </div>
           ))}
        </div>
      );
    }

    if (list.length === 0 && !isSearching && query) {
      return <div className="text-center py-20 text-slate-600 dark:text-slate-400">No results found for "{query}".</div>;
    }

    return (
      <div className="flex flex-col gap-1 w-full max-w-4xl mx-auto">
        {list.map((r, i) => (
          <div 
            key={i} 
            className="flex flex-col sm:flex-row gap-6 items-start py-8 px-2 border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-all cursor-pointer group w-full"
            onClick={() => loadArticle(r.title, undefined, r)}
          >
            {r.thumbnail ? (
              <div className="w-full sm:w-44 h-48 sm:h-44 shrink-0 bg-slate-100 dark:bg-[#0B1120] rounded-2xl overflow-hidden relative border border-slate-100 dark:border-slate-800/50 shadow-sm">
                <img src={r.thumbnail} crossOrigin="anonymous" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
              </div>
            ) : (
              <div className="w-full sm:w-44 h-48 sm:h-44 shrink-0 bg-slate-50 dark:bg-slate-800/30 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-slate-800/30">
                 <BookOpen size={32} className="text-slate-200 dark:text-slate-700" />
              </div>
            )}
            <div className="flex-1 min-w-0 w-full pt-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 bg-white dark:bg-slate-200 rounded-md flex items-center justify-center">
                   <span className="font-serif font-black text-black text-[10px]">W</span>
                </div>
                <span className="text-[12px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Wikipedia</span>
              </div>
              <h3 className="text-[22px] sm:text-[24px] font-black text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 leading-tight transition-colors mb-3">
                {r.title}
              </h3>
              <p 
                className="text-[15px] sm:text-[16px] leading-relaxed text-slate-500 dark:text-slate-400 mb-6 line-clamp-3 break-words font-medium"
                dangerouslySetInnerHTML={{ __html: r.snippet || r.summary || "" }}
              />
              
              <div className="flex items-center justify-between group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-3 text-[12px] font-semibold text-slate-400 dark:text-slate-600">
                    <span>{r.wordcount ? `${Math.max(1, Math.ceil(r.wordcount / 200))}m reading` : '3m reading'}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />
                    <span className="hidden sm:inline">{r.timestamp && new Date(r.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</span>
                  </div>
                 <div className="flex items-center gap-4 text-slate-400 dark:text-slate-500">
                   <button onClick={(e) => { e.stopPropagation(); toggleSaveArticle(r); }} className="hover:text-blue-500 transition-all transform active:scale-90">
                     <Bookmark size={18} fill={savedArticles.find(a => a.title === r.title) ? "currentColor" : "none"} className={savedArticles.find(a => a.title === r.title) ? "text-blue-500" : ""} />
                   </button>
                   <button 
                     onClick={(e) => { 
                       e.stopPropagation(); 
                       window.open(`https://${language}.wikipedia.org/wiki/${encodeURIComponent(r.title)}`, '_blank'); 
                     }} 
                     className="hover:text-slate-900 dark:hover:text-white transition-all transform active:scale-90"
                   >
                     <ExternalLink size={18} />
                   </button>
                 </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );

  };

  const renderKnowledgePanel = () => {
    if (activeSidebarItem === "Saved" || activeTab === "Images") return null;

    if (isSearching && !knowledgePanel) {
      return (
        <div className="w-[380px] shrink-0 sticky top-36 hidden xl:block">
           <div className="bg-white dark:bg-[#151D2C] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 h-[600px] animate-pulse"></div>
        </div>
      );
    }

    if (!knowledgePanel) return null;

    return (
      <div className="w-[380px] shrink-0 sticky top-36 hidden xl:block h-fit max-h-[calc(100vh-140px)] overflow-y-auto no-scrollbar pb-10">
         <div className="bg-white dark:bg-[#151D2C] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
           {knowledgePanel.thumbnail?.source && (
             <div className="w-full h-[280px] relative group border-b border-slate-200 dark:border-slate-800">
               <img src={knowledgePanel.thumbnail.source} crossOrigin="anonymous" className="w-full h-full object-cover" />
               <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#151D2C] via-white/40 dark:via-[#151D2C]/40 to-transparent"></div>
               <button onClick={() => toggleSaveArticle(knowledgePanel)} className={`absolute top-4 right-4 w-10 h-10 ${savedArticles.find(a => a.title === knowledgePanel.title) ? 'bg-blue-500/80 hover:bg-blue-600' : 'bg-black/40 hover:bg-black/60'} backdrop-blur-md rounded-full flex items-center justify-center text-white transition`}>
                  <Bookmark size={18} fill={savedArticles.find(a => a.title === knowledgePanel.title) ? "currentColor" : "none"} />
               </button>
               <div className="absolute bottom-6 left-6 right-6">
                 <h2 className="text-4xl font-extrabold text-white mb-1 shadow-black drop-shadow-xl">{knowledgePanel.title}</h2>
                 <p className="text-[15px] font-medium text-slate-700 dark:text-slate-300">{knowledgePanel.description}</p>
               </div>
             </div>
           )}
           <div className="p-6">
             {!knowledgePanel.thumbnail?.source && (
               <div className="mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                 <h2 className="text-3xl font-extrabold text-white mb-2">{knowledgePanel.title}</h2>
                 <p className="text-[15px] text-slate-600 dark:text-slate-400 font-medium">{knowledgePanel.description}</p>
               </div>
             )}
             
             <p className="text-[15px] leading-[1.7] text-slate-700 dark:text-slate-300 mb-8 font-medium">
               {knowledgePanel.extract}
             </p>

             <div className="grid grid-cols-2 gap-y-4 gap-x-2 mb-8 text-[13px]">
               <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400"><Layers size={14}/> Description</div>
               <div className="text-slate-800 dark:text-slate-200 font-semibold truncate" title={knowledgePanel.description}>{knowledgePanel.description || 'General Content'}</div>
               
               {knowledgePanel.wordcount && (
                 <>
                   <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400"><BookOpen size={14}/> Reading Time</div>
                   <div className="text-slate-800 dark:text-slate-200 font-semibold">{Math.max(1, Math.ceil(knowledgePanel.wordcount / 200))} min read</div>
                 </>
               )}

               {knowledgePanel.timestamp && (
                 <>
                   <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400"><Clock size={14}/> Last Modified</div>
                   <div className="text-slate-800 dark:text-slate-200 font-semibold">{new Date(knowledgePanel.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                 </>
               )}
             </div>

             {knowledgePanel.categories && knowledgePanel.categories.length > 0 && (
               <div className="mb-8">
                 <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-200 mb-3">Categories</h4>
                 <div className="flex flex-wrap gap-2">
                   {knowledgePanel.categories.slice(0, 6).map((cat: string, i: number) => (
                     <span key={i} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[12px] font-medium">
                       {cat}
                     </span>
                   ))}
                 </div>
               </div>
             )}

             {knowledgePanel.related && knowledgePanel.related.length > 0 && (
               <div className="mb-8">
                 <div className="flex justify-between items-center mb-4">
                   <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-200">Related Images</h4>
                   <a href="#" className="text-[12px] text-blue-400 hover:underline">View all</a>
                 </div>
                 <div className="grid grid-cols-4 gap-2">
                   {knowledgePanel.related.map((rel: any, i: number) => rel.thumbnail && (
                      <div key={i} className="aspect-square rounded-xl overflow-hidden cursor-pointer" onClick={() => loadArticle(rel.title)}>
                        <img src={rel.thumbnail.source} className="w-full h-full object-cover hover:scale-110 transition-transform" />
                      </div>
                   ))}
                 </div>
               </div>
             )}

             {knowledgePanel.related && knowledgePanel.related.length > 0 && (
               <div className="mb-8">
                 <div className="flex justify-between items-center mb-4">
                    <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-200">Related Topics</h4>
                    <a href="#" className="text-[12px] text-blue-400 hover:underline">View all</a>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {knowledgePanel.related.slice(0, 5).map((rel: any, i: number) => (
                      <button 
                        key={i} 
                        onClick={() => executeSearch(rel.title)}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:border-slate-500 rounded-xl text-[13px] text-slate-700 dark:text-slate-300 font-medium transition-colors bg-slate-800/30"
                      >
                        {rel.title.split(' (')[0]}
                      </button>
                    ))}
                 </div>
               </div>
             )}

             <div className="flex gap-3">
               <button 
                 onClick={() => loadArticle(knowledgePanel.title)}
                 className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.2)]"
               >
                 <BookOpen size={18} /> Read Full Article
               </button>
               <button 
                 onClick={() => toggleSaveArticle(knowledgePanel)}
                 className={`p-3.5 border border-slate-300 dark:border-slate-700 transition-colors rounded-xl ${savedArticles.find(a => a.title === knowledgePanel.title) ? 'text-blue-500 bg-blue-500/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
               >
                 <Bookmark size={20} fill={savedArticles.find(a => a.title === knowledgePanel.title) ? "currentColor" : "none"} />
               </button>
             </div>
           </div>
         </div>
      </div>
    );
  };

  const renderImages = () => {
    if (activeTab !== "Images" && activeSidebarItem !== "Images") return null;

    const masonryClass = lightboxImage 
      ? "columns-2 md:columns-3 lg:columns-2 xl:columns-3 gap-4" 
      : "columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4";

    if (isSearching && imageResults.length === 0) {
       return (
         <div className={masonryClass}>
           {[...Array(15)].map((_, i) => (
             <div key={i} className="animate-pulse bg-white dark:bg-[#151D2C] border border-slate-200 dark:border-slate-800 rounded-2xl mb-4 w-full inline-block" style={{ height: `${Math.random() * 200 + 100}px` }}></div>
           ))}
         </div>
       );
    }

    if (imageResults.length === 0) return <div className="text-center mt-10 text-slate-500">No images found</div>;

    return (
      <div className={masonryClass}>
        {imageResults.map((page, i) => {
          const img = page.imageinfo?.[0];
          if (!img) return null;
          return (
            <div 
              key={i} 
              className="break-inside-avoid mb-4 inline-block w-full relative group rounded-2xl overflow-hidden bg-white dark:bg-[#151D2C] cursor-zoom-in"
              onClick={() => setLightboxImage({ page, img })}
            >
              <img src={img.url} crossOrigin="anonymous" className="w-full h-auto object-cover select-none group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end pointer-events-none">
                 <p className="text-white text-sm font-bold line-clamp-2 drop-shadow-md mb-1">{page.title.replace('File:', '')}</p>
                 <p className="text-white/70 text-[11px]">{img.width}x{img.height}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const [lightboxImage, setLightboxImage] = useState<any | null>(null);
  const renderImagePanel = () => {
    if ((activeTab !== "Images" && activeSidebarItem !== "Images") || !lightboxImage) return null;
    const { page, img } = lightboxImage;

    return (
      <>
        {/* Mobile Full Screen overlay */}
        <AnimatePresence>
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="xl:hidden fixed inset-0 z-[200] bg-white dark:bg-[#0B1120] flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold truncate max-w-[70%]">{page.title.replace('File:', '')}</h3>
              <button className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white" onClick={() => setLightboxImage(null)}>
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <div className="bg-slate-100 dark:bg-black/40 w-full aspect-square md:aspect-video flex items-center justify-center p-4">
                <img src={img.url} crossOrigin="anonymous" className="max-w-full max-h-full object-contain shadow-lg" loading="lazy" />
              </div>
              <div className="p-6">
                <a href={img.descriptionurl} target="_blank" rel="noreferrer" className="text-xl font-bold hover:text-blue-500 mb-2 block">
                  {page.title.replace('File:', '')}
                </a>
                <p className="text-sm text-slate-500 mb-4">{img.width} x {img.height} pixels</p>
                <a href={img.url} target="_blank" rel="noreferrer" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-500 transition-colors">
                  <ExternalLink size={18} /> View Original Image
                </a>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Desktop Side Panel */}
        <div className="w-[400px] shrink-0 sticky top-36 hidden xl:flex flex-col h-fit max-h-[calc(100vh-140px)] overflow-y-auto no-scrollbar pb-10">
          <div className="bg-white dark:bg-[#151D2C] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="w-full relative bg-slate-100 dark:bg-black/40 min-h-[250px] flex items-center justify-center p-4 group">
               <img src={img.url} crossOrigin="anonymous" className="w-full h-auto max-h-[400px] object-contain shadow-lg" />
               <button className="absolute top-4 right-4 p-2 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60" onClick={() => setLightboxImage(null)}>
                 <X size={20} />
               </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
               <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-tight mb-1" title={page.title}>{page.title.replace('File:', '')}</h3>
                  <div className="text-sm text-slate-500">{img.width} x {img.height} - {Math.round(img.size / 1024)} KB</div>
               </div>
               
               <div className="grid grid-cols-2 gap-3 mt-2">
                 <a href={img.descriptionurl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                   <Info size={16} /> Details
                 </a>
                 <a href={img.url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                   <ExternalLink size={16} /> Original
                 </a>
               </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderLoadMore = () => {
    if (!query || activeSidebarItem === "Saved" || !hasMore) return null;
    return (
      <div className="flex justify-center mt-6 pb-20">
        <button 
          onClick={() => executeSearch(query, offset + limit)}
          disabled={isSearching}
          className="px-8 py-3.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-full font-bold transition-colors disabled:opacity-50 flex items-center gap-2 border border-blue-500/20 hover:border-blue-500/40"
        >
          {isSearching ? <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div> : "Load More"}
        </button>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex bg-white dark:bg-[#0B1120] text-slate-800 dark:text-slate-200 overflow-hidden style-wrapper font-sans">
      <style dangerouslySetInnerHTML={{__html: `
        .searchmatch { font-weight: bold; color: #60a5fa; background: rgba(96, 165, 250, 0.15); border-radius: 2px; padding: 0 2px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      {/* Left Container - Knowledge Navigation */}
      {renderSidebar()}

      {/* Right Container - Content Viewer area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden bg-slate-50 dark:bg-[#0F1623]">
        <AnimatePresence mode="wait">
           {activeArticle && (
             <ArticleReader 
               activeArticle={activeArticle} 
               setActiveArticle={setActiveArticle} 
               loadArticle={loadArticle}
               toggleSaveArticle={toggleSaveArticle}
               savedArticles={savedArticles}
               language={language}
             />
           )}
        </AnimatePresence>

        {/* Existing Content Layer */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative no-scrollbar">
           {renderTopBar()}
           
           <div className="flex-1 w-full max-w-[1800px] mx-auto px-4 sm:px-8 pt-2 pb-20">
              {renderStats()}
              <div className="flex flex-col lg:flex-row gap-8">
                 <div className="flex-1 min-w-0">
                   {activeTab === "Images" || activeSidebarItem === "Images" ? renderImages() : renderResults()}
                   {renderLoadMore()}
                 </div>
                 {(activeTab !== "Images" && activeSidebarItem !== "Images") && renderKnowledgePanel()}
                 {renderImagePanel()}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}


