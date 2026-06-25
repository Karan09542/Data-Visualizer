import { useState, useEffect } from 'react';
import { discoverAudio } from '../services/audioDiscovery';
import { AudioTrack } from '../types/audio';

export const useAudioLibrary = () => {
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadLibrary = async () => {
    setIsLoading(true);
    try {
      const discoveredTracks = await discoverAudio();
      setTracks(discoveredTracks);
    } catch (err) {
      console.error('Failed to discover audio', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  const filteredTracks = tracks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return {
    tracks: filteredTracks,
    isLoading,
    searchQuery,
    setSearchQuery,
    refreshLibrary: loadLibrary
  };
};
