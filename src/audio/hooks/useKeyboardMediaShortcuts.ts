import { useEffect } from 'react';
import { useAudioStore } from '../stores/audioStore';
import { audioEngine } from '../services/audioEngine';

export const useKeyboardMediaShortcuts = () => {
  const togglePlayer = useAudioStore(state => state.togglePlayer);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + A to toggle player modal
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        togglePlayer();
        return;
      }

      // Media keys (global, standard OS integration often handles these but nice to have)
      if (e.key === 'MediaPlayPause') {
        e.preventDefault();
        audioEngine.togglePlay();
      } else if (e.key === 'MediaTrackNext') {
        e.preventDefault();
        audioEngine.next();
      } else if (e.key === 'MediaTrackPrevious') {
        e.preventDefault();
        audioEngine.previous();
      } else if (e.key === 'MediaStop') {
        e.preventDefault();
        audioEngine.stop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayer]);
};
