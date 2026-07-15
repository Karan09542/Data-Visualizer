import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Search, X, Play, Plus, Loader2, AlertCircle, Youtube as YoutubeIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SearchResult {
  id: string;
  type: string;
  thumbnail: { thumbnails: { url: string; width: number; height: number }[] };
  title: string;
  channelTitle: string;
  shortBylineText: any;
  length: { accessibility: { title: string }; simpleText: string };
  isLive: boolean;
}

export default function YoutubeSearchPanel() {
  const { isYoutubeSearchOpen, setIsYoutubeSearchOpen, parsedData, setCode } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [nextPageData, setNextPageData] = useState<any>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isYoutubeSearchOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isYoutubeSearchOpen]);

  if (!isYoutubeSearchOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults([]);
    setActiveVideoId(null);
    setNextPageData(null);
    setHasSearched(true);

    try {
      const response = await fetch(`https://yts-tau.vercel.app/api/search?q=${encodeURIComponent(query)}&limit=20`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Search failed');
      }
      
      if (data.data && data.data.items) {
        setResults(data.data.items.filter((item: any) => item.type === 'video'));
        if (data.data.nextPage) {
          setNextPageData(data.data.nextPage);
        }
      }
    } catch (err: any) {
      console.error('YouTube search error:', err);
      setError(err.message || 'Failed to fetch YouTube results.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextPageData) return;
    setIsLoadingMore(true);
    try {
      const response = await fetch(`https://yts-tau.vercel.app/api/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextPage: nextPageData })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Pagination failed');
      }
      
      if (data.data && data.data.items && data.data.items.length > 0) {
        setResults(prev => {
          const newVids = data.data.items.filter((item: any) => item.type === 'video');
          return [...prev, ...newVids];
        });
        setNextPageData(data.data.nextPage || null);
      } else {
        setNextPageData(null);
      }
    } catch (err: any) {
      console.error('YouTube load more error:', err);
      alert('Failed to load more videos. This might be due to API constraints.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleAddToCanvas = (video: SearchResult) => {
    const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
    const newId = `youtube_${video.id}`;
    
    let currentData = parsedData || {};
    
    if (currentData.dataSources && typeof currentData.dataSources === 'object') {
      currentData = {
        ...currentData,
        dataSources: {
          ...currentData.dataSources,
          [newId]: videoUrl
        }
      };
    } else {
      currentData = {
        ...currentData,
        [newId]: videoUrl
      };
    }

    setCode(JSON.stringify(currentData, null, 2));
    setIsYoutubeSearchOpen(false);
  };

  return (
    <AnimatePresence>
      {isYoutubeSearchOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-[#0f0f0f] overflow-hidden"
        >
          {/* Header */}
          <div className="flex-none px-6 py-4 md:px-12 md:py-8 border-b border-gray-200 dark:border-gray-800 flex justify-between items-start bg-white dark:bg-[#0f0f0f] sticky top-0 z-20">
            <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 relative">
              <button
                onClick={() => setIsYoutubeSearchOpen(false)}
                className="absolute -right-4 -top-2 p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                title="Close"
              >
                <X size={24} />
              </button>
              
              <div>
                <h1 className="text-3xl font-bold text-black dark:text-white">YouTube Search</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Powered by youtube-search-api</p>
              </div>

              <form onSubmit={handleSearch} className="flex w-full gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="flex-1 px-4 py-2.5 text-base bg-white dark:bg-[#121212] border border-gray-300 dark:border-gray-700 rounded-lg text-black dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setResults([]);
                    setNextPageData(null);
                    setHasSearched(false);
                    setError(null);
                    inputRef.current?.focus();
                  }}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-[#272727] text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-[#3f3f3f] transition-colors whitespace-nowrap"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#0f0f0f] dark:bg-gray-200 text-white dark:text-black font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-white transition-colors"
                >
                  Search
                </button>
              </form>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto px-6 py-8 md:px-12 bg-[#f9f9f9] dark:bg-[#0f0f0f] custom-scrollbar">
            <div className="w-full max-w-6xl mx-auto h-full">
              
              {isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
                  <p className="text-base">Loading...</p>
                </div>
              )}

              {error && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <AlertCircle size={40} className="mb-4 text-red-500" />
                  <p className="text-lg text-gray-800 dark:text-gray-200 mb-4">{error}</p>
                  <button 
                    onClick={() => handleSearch()}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {!isLoading && !error && !hasSearched && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                  <div className="p-6 bg-gray-100 dark:bg-gray-800/50 rounded-full mb-6">
                    <YoutubeIcon size={64} className="text-gray-300 dark:text-gray-600" />
                  </div>
                  <p className="text-xl font-medium text-gray-500 dark:text-gray-400">Search for videos to add to your canvas</p>
                </div>
              )}

              {!isLoading && !error && hasSearched && results.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <p className="text-lg">No results found for "{query}"</p>
                </div>
              )}

              {/* Results Grid */}
              {!isLoading && !error && results.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-x-4 md:gap-y-8">
                  {results.map((video) => (
                    <div 
                      key={video.id} 
                      className="group flex flex-col bg-white dark:bg-[#121212] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                    >
                      {/* Thumbnail / Player Area */}
                      <div className="relative aspect-video bg-black w-full overflow-hidden rounded-t-xl">
                        {activeVideoId === video.id ? (
                          <iframe
                            width="100%"
                            height="100%"
                            src={`https://www.youtube.com/embed/${video.id}?autoplay=1`}
                            title={video.title}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="absolute inset-0"
                          />
                        ) : (
                          <>
                            <img 
                              src={video.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} 
                              alt={video.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                              <button 
                                onClick={() => setActiveVideoId(video.id)}
                                className="w-12 h-12 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-red-600 transition-colors backdrop-blur-sm"
                                title="Play Video"
                              >
                                <Play size={24} className="ml-1" fill="currentColor" />
                              </button>
                            </div>
                            {video.length?.simpleText && (
                              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-white text-[11px] font-medium rounded">
                                {video.length.simpleText}
                              </div>
                            )}
                            {video.isLive && (
                              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-red-600 text-white text-[11px] font-bold rounded uppercase">
                                Live
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Info Area */}
                      <div className="p-3 flex flex-col flex-1">
                        <h3 className="text-sm font-semibold text-[#0f0f0f] dark:text-[#f1f1f1] line-clamp-2 leading-tight mb-1" title={video.title}>
                          {video.title}
                        </h3>
                        <div className="text-xs text-[#606060] dark:text-[#aaaaaa] mb-3">
                          {video.channelTitle}
                        </div>
                        
                        <div className="mt-auto pt-2 border-t border-gray-100 dark:border-gray-800">
                          <button 
                            onClick={() => handleAddToCanvas(video)}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-md text-xs font-semibold transition-colors"
                          >
                            <Plus size={14} />
                            <span>Add to Canvas</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!isLoading && !error && results.length > 0 && nextPageData && (
                <div className="flex justify-center mt-8 mb-16 pb-8">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="px-8 py-2.5 bg-white dark:bg-[#121212] border border-gray-300 dark:border-gray-700 text-blue-600 dark:text-blue-400 font-medium rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-2"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
